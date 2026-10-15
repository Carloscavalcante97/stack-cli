import type { Answers } from '../types.js'
import { usesPostgres } from '../types.js'

// Camada Firebase sobre os templates JWT de cada backend: cada entrada troca o
// conteúdo de um arquivo; null remove o arquivo (cadastro, login e senha passam
// a ser do Firebase, no frontend). O backend só verifica o ID token.
export type FileOverlay = Record<string, string | null>

type NodeDi = 'tsyringe' | 'nest'

function di(kind: NodeDi) {
  return kind === 'nest'
    ? {
        imports: "import { Inject, Injectable } from '@nestjs/common'",
        injectableImport: "import { Injectable } from '@nestjs/common'",
        injectable: '@Injectable()',
        inject: '@Inject',
      }
    : {
        imports: "import { inject, injectable } from 'tsyringe'",
        injectableImport: "import { injectable } from 'tsyringe'",
        injectable: '@injectable()',
        inject: '@inject',
      }
}

// ---------- Node (Express e Nest) ----------

const userEntityTs = `export class UserEntity {
  constructor(
    public readonly id: string, // UID do Firebase
    public readonly name: string,
    public readonly email: string,
    public readonly createdAt: string,
  ) {}
}
`

const userRepositoryContractTs = `import { UserEntity } from '../entities/user.entity.js'

export abstract class UserRepositoryContract {
  abstract findOrCreate(input: {
    id: string
    name: string
    email: string
  }): Promise<UserEntity>
}
`

const tokenServiceContractTs = `export type AccessTokenPayload = {
  sub: string
  email: string
  name: string
}

// O Firebase emite o token no frontend; o backend só verifica
export abstract class TokenServiceContract {
  abstract verifyAccessToken(token: string): Promise<AccessTokenPayload>
}
`

const prismaSchema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id // UID do Firebase
  name      String
  email     String
  createdAt DateTime @default(now())
}
`

function getCurrentUserUseCaseTs(kind: NodeDi) {
  const d = di(kind)
  return `${d.imports}
import { UserRepositoryContract } from '../../../domain/users/contracts/user-repository.contract.js'
import type { AccessTokenPayload } from '../../security/contracts/token-service.contract.js'

${d.injectable}
export class GetCurrentUserUseCase {
  constructor(
    ${d.inject}('UserRepositoryContract')
    private readonly userRepository: UserRepositoryContract,
  ) {}

  // O primeiro acesso de um usuário do Firebase cria o registro local
  async execute(identity: AccessTokenPayload) {
    const user = await this.userRepository.findOrCreate({
      id: identity.sub,
      name: identity.name,
      email: identity.email,
    })

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    }
  }
}
`
}

function inMemoryUserRepositoryTs(kind: NodeDi) {
  const d = di(kind)
  return `${d.injectableImport}
import { UserRepositoryContract } from '../../domain/users/contracts/user-repository.contract.js'
import { UserEntity } from '../../domain/users/entities/user.entity.js'

${d.injectable}
export class InMemoryUserRepository implements UserRepositoryContract {
  private static readonly users = new Map<string, UserEntity>()

  async findOrCreate(input: { id: string; name: string; email: string }) {
    const existing = InMemoryUserRepository.users.get(input.id)
    if (existing) return existing

    const user = new UserEntity(input.id, input.name, input.email, new Date().toISOString())
    InMemoryUserRepository.users.set(user.id, user)
    return user
  }
}
`
}

function prismaUserRepositoryTs(kind: NodeDi) {
  const d = di(kind)
  return `${d.injectableImport}
import { prisma } from '../database/prisma/client.js'
import { UserRepositoryContract } from '../../domain/users/contracts/user-repository.contract.js'
import { UserEntity } from '../../domain/users/entities/user.entity.js'

${d.injectable}
export class PrismaUserRepository implements UserRepositoryContract {
  async findOrCreate(input: { id: string; name: string; email: string }) {
    const user = await prisma.user.upsert({
      where: { id: input.id },
      create: input,
      update: {},
    })

    return new UserEntity(user.id, user.name, user.email, user.createdAt.toISOString())
  }
}
`
}

function firebaseTokenServiceTs(kind: NodeDi) {
  const nest = kind === 'nest'
  return `${nest ? "import { Injectable } from '@nestjs/common'\n" : ''}import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import type { AccessTokenPayload } from '../../application/security/contracts/token-service.contract.js'
import { TokenServiceContract } from '../../application/security/contracts/token-service.contract.js'
${nest ? "import { loadEnv } from '../../shared/config/env.js'" : "import type { AppEnv } from '../../shared/config/env.js'"}
import { AppError } from '../../shared/errors/app-error.js'

${nest ? '@Injectable()\n' : ''}export class FirebaseTokenService implements TokenServiceContract {
  private readonly auth: Auth

  constructor(${nest ? '' : "env: Pick<AppEnv, 'FIREBASE_PROJECT_ID'>"}) {
    // Verificar ID token só precisa do projectId (as chaves públicas vêm do Google).
    // Service account só é necessária para operações de admin (claims, criar usuário).
    const projectId = ${nest ? 'loadEnv().firebaseProjectId' : 'env.FIREBASE_PROJECT_ID'}
    this.auth = getAuth(getApps()[0] ?? initializeApp({ projectId }))
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const decoded = await this.auth.verifyIdToken(token)
      return {
        sub: decoded.uid,
        // ponytail: login por telefone/anônimo não tem e-mail; torne opcional se habilitar
        email: decoded.email ?? '',
        name: decoded.name ?? decoded.email ?? '',
      }
    } catch (error) {
      // Só erro de token vira 401; falha de rede ou de config continua 500
      if (String((error as { code?: unknown }).code).startsWith('auth/')) {
        throw new AppError('Token inválido ou expirado.', 401, 'INVALID_TOKEN')
      }
      throw error
    }
  }
}
`
}

function nodeSharedOverlay(kind: NodeDi, answers: Answers): FileOverlay {
  return {
    'src/application/security/contracts/password-hasher.contract.ts': null,
    'src/application/users/use-cases/register-user.use-case.ts': null,
    'src/application/auth/use-cases/login.use-case.ts': null,
    'src/infra/security/bcrypt-password-hasher.ts': null,
    'src/infra/security/jwt-token.service.ts': null,
    'src/presentation/http/controllers/auth.controller.ts': null,

    'src/domain/users/entities/user.entity.ts': userEntityTs,
    'src/domain/users/contracts/user-repository.contract.ts': userRepositoryContractTs,
    'src/application/security/contracts/token-service.contract.ts': tokenServiceContractTs,
    'src/application/users/use-cases/get-current-user.use-case.ts': getCurrentUserUseCaseTs(kind),
    'src/infra/security/firebase-token.service.ts': firebaseTokenServiceTs(kind),
    'src/infra/repositories/in-memory-user.repository.ts': inMemoryUserRepositoryTs(kind),
    ...(usesPostgres(answers)
      ? {
          'prisma/schema.prisma': prismaSchema,
          'src/infra/repositories/prisma-user.repository.ts': prismaUserRepositoryTs(kind),
        }
      : {}),
  }
}

export function expressFirebaseOverlay(answers: Answers): FileOverlay {
  const withPostgres = usesPostgres(answers)
  const repository = withPostgres ? 'PrismaUserRepository' : 'InMemoryUserRepository'
  const repositoryFile = withPostgres ? 'prisma-user.repository' : 'in-memory-user.repository'

  return {
    ...nodeSharedOverlay('tsyringe', answers),
    'src/application/users/dto/register-user.input.ts': null,
    'src/application/auth/dto/login.input.ts': null,
    'src/application/auth/dto/auth.output.ts': null,
    'src/presentation/http/schemas/register-user.schema.ts': null,
    'src/presentation/http/schemas/login.schema.ts': null,

    'src/infra/container/build-http-dependencies.ts': `import { Router } from 'express'
import { container, type DependencyContainer } from 'tsyringe'
import { TokenServiceContract } from '../../application/security/contracts/token-service.contract.js'
import { GetCurrentUserUseCase } from '../../application/users/use-cases/get-current-user.use-case.js'
import { UserRepositoryContract } from '../../domain/users/contracts/user-repository.contract.js'
import { FirebaseTokenService } from '../security/firebase-token.service.js'
import type { AppEnv } from '../../shared/config/env.js'
import { HealthController } from '../../presentation/http/controllers/health.controller.js'
import { UsersController } from '../../presentation/http/controllers/users.controller.js'
import { createAuthMiddleware } from '../../presentation/http/middlewares/auth-middleware.js'
import { createApiRouter } from '../../presentation/http/routes/index.js'
import { ${repository} } from '../repositories/${repositoryFile}.js'

function buildContainer(env: AppEnv): DependencyContainer {
  const scopedContainer = container.createChildContainer()

  scopedContainer.registerSingleton(GetCurrentUserUseCase, GetCurrentUserUseCase)
  scopedContainer.register<TokenServiceContract>('TokenServiceContract', {
    useValue: new FirebaseTokenService(env),
  })
  scopedContainer.registerSingleton<UserRepositoryContract>(
    'UserRepositoryContract',
    ${repository},
  )

  return scopedContainer
}

export function buildHttpDependencies(env: AppEnv): { router: Router } {
  const scopedContainer = buildContainer(env)

  return {
    router: createApiRouter({
      usersController: new UsersController(scopedContainer.resolve(GetCurrentUserUseCase)),
      healthController: new HealthController(),
      authMiddleware: createAuthMiddleware(
        scopedContainer.resolve<TokenServiceContract>('TokenServiceContract'),
      ),
    }),
  }
}
`,
    'src/presentation/http/controllers/users.controller.ts': `import type { Request, Response } from 'express'
import { GetCurrentUserUseCase } from '../../../application/users/use-cases/get-current-user.use-case.js'

export class UsersController {
  constructor(private readonly getCurrentUserUseCase: GetCurrentUserUseCase) {}

  async me(req: Request, res: Response) {
    const result = await this.getCurrentUserUseCase.execute(req.auth!)
    return res.status(200).json(result)
  }
}
`,
    'src/presentation/http/routes/index.ts': `import { Router, type RequestHandler } from 'express'
import { HealthController } from '../controllers/health.controller.js'
import { UsersController } from '../controllers/users.controller.js'
import { asyncHandler } from '../middlewares/async-handler.js'

type CreateApiRouterInput = {
  usersController: UsersController
  healthController: HealthController
  authMiddleware: RequestHandler
}

// Cadastro e login acontecem no frontend com o SDK do Firebase
export function createApiRouter({
  usersController,
  healthController,
  authMiddleware,
}: CreateApiRouterInput) {
  const router = Router()

  router.get('/health', (req, res) => healthController.handle(req, res))
  router.get(
    '/users/me',
    asyncHandler(authMiddleware),
    asyncHandler((req, res) => usersController.me(req, res)),
  )

  return router
}
`,
  }
}

export function nestFirebaseOverlay(answers: Answers): FileOverlay {
  return {
    ...nodeSharedOverlay('nest', answers),
    'src/presentation/http/dto/register-user.dto.ts': null,
    'src/presentation/http/dto/login.dto.ts': null,
    'src/presentation/http/guards/jwt-auth.guard.ts': null,
    'src/modules/auth/auth.module.ts': null,

    'src/app.module.ts': `import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { SecurityModule } from './infra/modules/security.module.js'
import { HealthModule } from './modules/health/health.module.js'
import { UsersModule } from './modules/users/users.module.js'
import { FirebaseAuthGuard } from './presentation/http/guards/firebase-auth.guard.js'

// Toda rota exige token por padrão; libere com @Public()
@Module({
  imports: [SecurityModule, HealthModule, UsersModule],
  providers: [{ provide: APP_GUARD, useClass: FirebaseAuthGuard }],
})
export class AppModule {}
`,
    'src/infra/modules/security.module.ts': `import { Module } from '@nestjs/common'
import { FirebaseTokenService } from '../security/firebase-token.service.js'

@Module({
  providers: [
    FirebaseTokenService,
    {
      provide: 'TokenServiceContract',
      useExisting: FirebaseTokenService,
    },
  ],
  exports: ['TokenServiceContract'],
})
export class SecurityModule {}
`,
    'src/presentation/http/decorators/public.decorator.ts': `import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
`,
    'src/presentation/http/decorators/current-user.decorator.ts': `import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { AccessTokenPayload } from '../../../application/security/contracts/token-service.contract.js'

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenPayload =>
    context.switchToHttp().getRequest().user,
)
`,
    'src/presentation/http/guards/firebase-auth.guard.ts': `import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import {
  TokenServiceContract,
  type AccessTokenPayload,
} from '../../../application/security/contracts/token-service.contract.js'
import { AppError } from '../../../shared/errors/app-error.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject('TokenServiceContract')
    private readonly tokenService: TokenServiceContract,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    // Método antes da classe: uma rota @Public() pode viver num controller protegido
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>()
    const authorization = request.headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError('Token ausente.', 401, 'MISSING_TOKEN')
    }

    request.user = await this.tokenService.verifyAccessToken(authorization.slice(7).trim())
    return true
  }
}
`,
    'src/presentation/http/controllers/health.controller.ts': `import { Controller, Get } from '@nestjs/common'
import { Public } from '../decorators/public.decorator.js'

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  handle() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
`,
    'src/presentation/http/controllers/users.controller.ts': `import { Controller, Get } from '@nestjs/common'
import type { AccessTokenPayload } from '../../../application/security/contracts/token-service.contract.js'
import { GetCurrentUserUseCase } from '../../../application/users/use-cases/get-current-user.use-case.js'
import { CurrentUser } from '../decorators/current-user.decorator.js'

@Controller('users')
export class UsersController {
  constructor(private readonly getCurrentUserUseCase: GetCurrentUserUseCase) {}

  @Get('me')
  me(@CurrentUser() identity: AccessTokenPayload) {
    return this.getCurrentUserUseCase.execute(identity)
  }
}
`,
    'src/modules/users/users.module.ts': `import { Module } from '@nestjs/common'
import { GetCurrentUserUseCase } from '../../application/users/use-cases/get-current-user.use-case.js'
import { PersistenceModule } from '../../infra/modules/persistence.module.js'
import { UsersController } from '../../presentation/http/controllers/users.controller.js'

@Module({
  imports: [PersistenceModule],
  controllers: [UsersController],
  providers: [GetCurrentUserUseCase],
})
export class UsersModule {}
`,
  }
}

// ---------- Python (FastAPI) ----------

export function fastApiFirebaseOverlay(answers: Answers): FileOverlay {
  return {
    'app/application/auth/__init__.py': null,
    'app/application/auth/dto/__init__.py': null,
    'app/application/auth/dto/login_command.py': null,
    'app/application/auth/dto/auth_result.py': null,
    'app/application/auth/use_cases/__init__.py': null,
    'app/application/auth/use_cases/login.py': null,
    'app/application/security/password_hasher_contract.py': null,
    'app/application/users/dto/register_user_command.py': null,
    'app/application/users/use_cases/register_user.py': null,
    'app/infra/security/password_hasher.py': null,
    'app/infra/security/jwt_token_service.py': null,
    'app/presentation/http/routes/auth.py': null,
    'tests/unit/test_register_user_use_case.py': null,
    'tests/unit/test_password_hasher.py': null,

    'app/domain/users/entities/user.py': `from dataclasses import dataclass


@dataclass(slots=True)
class UserEntity:
    id: str  # UID do Firebase
    name: str
    email: str
    created_at: str
`,
    'app/domain/users/contracts/user_repository.py': `from abc import ABC, abstractmethod

from app.domain.users.entities.user import UserEntity


class UserRepositoryContract(ABC):
    @abstractmethod
    def find_or_create(self, *, user_id: str, name: str, email: str) -> UserEntity:
        raise NotImplementedError
`,
    'app/application/security/token_service_contract.py': `from abc import ABC, abstractmethod


# O Firebase emite o token no frontend; o backend só verifica
class TokenServiceContract(ABC):
    @abstractmethod
    def verify_access_token(self, token: str) -> dict[str, str]:
        raise NotImplementedError
`,
    'app/application/users/use_cases/get_current_user.py': `from app.application.users.dto.user_result import UserResult
from app.domain.users.contracts.user_repository import UserRepositoryContract


class GetCurrentUserUseCase:
    def __init__(self, user_repository: UserRepositoryContract):
        self.user_repository = user_repository

    # O primeiro acesso de um usuário do Firebase cria o registro local
    def execute(self, identity: dict[str, str]) -> UserResult:
        user = self.user_repository.find_or_create(
            user_id=identity['sub'],
            name=identity['name'],
            email=identity['email'],
        )
        return UserResult(
            id=user.id,
            name=user.name,
            email=user.email,
            created_at=user.created_at,
        )
`,
    'app/infra/security/firebase_token_service.py': `import firebase_admin
from firebase_admin import auth

from app.application.security.token_service_contract import TokenServiceContract
from app.infra.config.settings import Settings
from app.shared.errors.app_error import AppError


class FirebaseTokenService(TokenServiceContract):
    def __init__(self, settings: Settings):
        # Em Python o SDK exige credencial para verificar token
        # (GOOGLE_APPLICATION_CREDENTIALS ou rodar no GCP), exceto no emulador.
        try:
            self.app = firebase_admin.get_app()
        except ValueError:
            self.app = firebase_admin.initialize_app(
                options={'projectId': settings.firebase_project_id}
            )

    def verify_access_token(self, token: str) -> dict[str, str]:
        try:
            decoded = auth.verify_id_token(token, app=self.app)
        except (auth.InvalidIdTokenError, ValueError) as error:
            raise AppError(
                'Token inválido ou expirado.', status_code=401, code='INVALID_TOKEN'
            ) from error

        # ponytail: login por telefone/anônimo não tem e-mail; torne opcional se habilitar
        email = decoded.get('email', '')
        return {
            'sub': decoded['uid'],
            'email': email,
            'name': decoded.get('name') or email,
        }
`,
    'app/infra/repositories/memory/user_repository.py': `from datetime import UTC, datetime

from app.domain.users.contracts.user_repository import UserRepositoryContract
from app.domain.users.entities.user import UserEntity


class InMemoryUserRepository(UserRepositoryContract):
    _users: dict[str, UserEntity] = {}

    def find_or_create(self, *, user_id: str, name: str, email: str) -> UserEntity:
        if user_id not in self._users:
            self._users[user_id] = UserEntity(
                id=user_id,
                name=name,
                email=email,
                created_at=datetime.now(UTC).isoformat(),
            )
        return self._users[user_id]
`,
    ...(usesPostgres(answers)
      ? {
          'app/infra/database/models/user_model.py': `from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.database.base import Base


class UserModel(Base):
    __tablename__ = 'users'

    id: Mapped[str] = mapped_column(String, primary_key=True)  # UID do Firebase
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
`,
          'app/infra/repositories/sqlalchemy/user_repository.py': `from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.domain.users.contracts.user_repository import UserRepositoryContract
from app.domain.users.entities.user import UserEntity
from app.infra.database.models.user_model import UserModel


class SqlAlchemyUserRepository(UserRepositoryContract):
    def __init__(self, session: Session):
        self.session = session

    def find_or_create(self, *, user_id: str, name: str, email: str) -> UserEntity:
        # ON CONFLICT evita corrida quando duas requisições chegam no primeiro acesso
        self.session.execute(
            insert(UserModel)
            .values(id=user_id, name=name, email=email)
            .on_conflict_do_nothing(index_elements=['id'])
        )
        self.session.commit()
        model = self.session.get_one(UserModel, user_id)
        return UserEntity(
            id=model.id,
            name=model.name,
            email=model.email,
            created_at=model.created_at.isoformat(),
        )
`,
        }
      : {}),
    'app/presentation/http/api.py': `from fastapi import APIRouter

from app.presentation.http.routes.health import router as health_router
from app.presentation.http.routes.users import router as users_router

# Cadastro e login acontecem no frontend com o SDK do Firebase
router = APIRouter()
router.include_router(health_router)
router.include_router(users_router)
`,
    'app/presentation/http/dependencies/use_cases.py': `from typing import Any

from fastapi import Depends

from app.application.users.use_cases.get_current_user import GetCurrentUserUseCase
from app.bootstrap.container import AppContainer
from app.presentation.http.dependencies.container import get_container
from app.presentation.http.dependencies.db import get_db_session


def get_current_user_use_case(
    container: AppContainer = Depends(get_container),
    db_session: Any | None = Depends(get_db_session),
) -> GetCurrentUserUseCase:
    return container.build_get_current_user_use_case(db_session)
`,
    'app/presentation/http/dependencies/auth.py': `from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.bootstrap.container import AppContainer
from app.presentation.http.dependencies.container import get_container
from app.shared.errors.app_error import AppError

security = HTTPBearer(auto_error=False)


def get_current_identity(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    container: AppContainer = Depends(get_container),
) -> dict[str, str]:
    if not credentials:
        raise AppError('Token ausente.', status_code=401, code='MISSING_TOKEN')

    return container.token_service.verify_access_token(credentials.credentials)
`,
    'app/presentation/http/routes/users.py': `from fastapi import APIRouter, Depends

from app.application.users.use_cases.get_current_user import GetCurrentUserUseCase
from app.presentation.http.dependencies.auth import get_current_identity
from app.presentation.http.dependencies.use_cases import get_current_user_use_case
from app.presentation.http.schemas.auth import UserResponse

router = APIRouter(prefix='/users', tags=['users'])


@router.get('/me', response_model=UserResponse)
def get_me(
    identity: dict[str, str] = Depends(get_current_identity),
    use_case: GetCurrentUserUseCase = Depends(get_current_user_use_case),
) -> UserResponse:
    result = use_case.execute(identity)
    return UserResponse(
        id=result.id,
        name=result.name,
        email=result.email,
        created_at=result.created_at,
    )
`,
    'app/presentation/http/schemas/auth.py': `from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    created_at: str
`,
    'tests/unit/test_get_current_user_use_case.py': `from app.application.users.use_cases.get_current_user import GetCurrentUserUseCase
from app.infra.repositories.memory.user_repository import InMemoryUserRepository


def test_first_access_creates_user_and_next_access_reuses_it():
    use_case = GetCurrentUserUseCase(InMemoryUserRepository())
    identity = {'sub': 'firebase-uid-1', 'email': 'ana@example.com', 'name': 'Ana'}

    first = use_case.execute(identity)
    second = use_case.execute({**identity, 'name': 'Outro nome'})

    assert first.id == 'firebase-uid-1'
    assert second.created_at == first.created_at
    assert second.name == 'Ana'
`,
  }
}
