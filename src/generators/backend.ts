import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { writeFile } from '../utils/fs.js'
import type { Answers } from '../types.js'
import { usesPostgres } from '../types.js'
import {
  expressFirebaseOverlay,
  fastApiFirebaseOverlay,
  nestFirebaseOverlay,
  type FileOverlay,
} from './firebase.js'

function createFiles(
  baseDir: string,
  files: Record<string, string>,
  overlay: FileOverlay = {},
) {
  for (const [relativePath, content] of Object.entries({ ...files, ...overlay })) {
    if (content !== null) writeFile(path.join(baseDir, relativePath), content)
  }
}

// Variáveis opcionais ficam comentadas: valor vazio quebra o SDK do Firebase
function getFirebaseEnvLines(answers: Answers) {
  return [
    '# ID do projeto: Console do Firebase > Configurações do projeto',
    'FIREBASE_PROJECT_ID=',
    ...(answers.backend === 'fastapi'
      ? [
          '# Python exige service account para verificar token (fora do GCP e do emulador)',
          '# GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/service-account.json',
        ]
      : []),
    '# Dev local sem projeto real: firebase emulators:start --only auth --project demo-app',
    '# FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099',
  ]
}

// .env.example vai pro git sem segredo; .env (ignorado) já nasce com um aleatório
function withEnvFiles(lines: (secret: string) => string[]) {
  const render = (secret: string) => `${lines(secret).join('\n')}\n`
  return {
    '.env.example': render(''),
    '.env': render(randomBytes(32).toString('base64url')),
  }
}

function getBackendEnvFiles(answers: Answers) {
  return withEnvFiles((secret) => [
    'PORT=3001',
    'GLOBAL_PREFIX=api',
    'NODE_ENV=development',
    'APP_NAME=Create Stack API',
    'CORS_ORIGIN=http://localhost:3000,http://localhost:5173',
    ...(answers.auth === 'firebase'
      ? getFirebaseEnvLines(answers)
      : [
          '# Gere com: openssl rand -base64 32',
          `JWT_ACCESS_SECRET=${secret}`,
          'JWT_ACCESS_EXPIRES_IN=1d',
        ]),
    ...(usesPostgres(answers)
      ? ['DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_db']
      : []),
  ])
}

function getBackendReadme(
  title: string,
  ormLabel: string,
  answers: Answers,
  runInstructions: string[],
) {
  const backendDataLayer = usesPostgres(answers) ? 'postgres' : 'memory'
  const withFirebase = answers.auth === 'firebase'
  const healthEndpoints =
    answers.backend === 'fastapi'
      ? ['- `GET /api/health/live`', '- `GET /api/health/ready`']
      : ['- `GET /api/health`']
  const sections = [
    `# ${title}`,
    '',
    '## Importante',
    ...(withFirebase
      ? ['- Preencha `FIREBASE_PROJECT_ID` no `.env` (Console do Firebase > Configurações do projeto).']
      : [
          '- O `.env` já vem gerado com um `JWT_ACCESS_SECRET` aleatório e fica fora do git.',
          '- Em um clone novo, copie `.env.example` para `.env` e gere o segredo com `openssl rand -base64 32`.',
        ]),
    `- ${usesPostgres(answers) ? 'Se PostgreSQL estiver habilitado, suba o banco antes do `dev`.' : 'Revise o `.env` antes do primeiro `dev`.'}`,
    '',
    'Estrutura inicial pronta para produção com:',
    '- Clean architecture (`domain`, `application`, `infra`, `presentation`)',
    '- Validação de payload e de ambiente',
    withFirebase
      ? '- Firebase Auth: o backend verifica o ID token enviado pelo frontend'
      : '- JWT para autenticação e proteção de rotas',
    `- ORM/persistência: ${ormLabel}`,
    '',
    '## Recursos habilitados',
    `- Persistência do backend: ${backendDataLayer}`,
    `- PostgreSQL: ${usesPostgres(answers) ? 'sim' : 'não'}`,
    `- Estratégia de auth do backend: ${withFirebase ? 'Firebase Auth' : 'JWT próprio'}`,
    '',
    ...(withFirebase
      ? [
          '## Firebase Auth',
          '- O frontend faz login com o SDK do Firebase e envia `Authorization: Bearer <ID token>`.',
          '- O backend só verifica o token. Cadastro, login e senha ficam no Firebase.',
          '- `GET /api/users/me` cria o usuário local (id = UID do Firebase) no primeiro acesso.',
          answers.backend === 'fastapi'
            ? '- O SDK Python exige credencial para verificar token: aponte `GOOGLE_APPLICATION_CREDENTIALS` para a service account (Console > Configurações do projeto > Contas de serviço) ou rode no GCP.'
            : '- Verificar token só precisa do `FIREBASE_PROJECT_ID`. Service account só é necessária para operações de admin (custom claims, criar usuário).',
          '- Dev local sem projeto real: na raiz, `firebase emulators:start --only auth --project demo-app`, com `FIREBASE_PROJECT_ID=demo-app` e `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` no `.env`.',
          '',
        ]
      : []),
    '## Como rodar',
    ...runInstructions,
    '',
    '## Endpoints iniciais',
    ...healthEndpoints,
    ...(withFirebase ? [] : ['- `POST /api/auth/register`', '- `POST /api/auth/login`']),
    '- `GET /api/users/me`',
  ]

  if (usesPostgres(answers)) {
    sections.push('- Garanta que o PostgreSQL esteja disponível em `DATABASE_URL` antes de subir a aplicação.')
  }

  if (answers.provisionPostgres) {
    sections.push(
      '',
      '## Infra local',
      'Para subir o PostgreSQL a partir de `apps/backend`, use:',
      '',
      '```bash',
      'docker compose -f ../../infra/docker/docker-compose.yml up -d',
      '```',
      '',
      'Para derrubar a infraestrutura:',
      '',
      '```bash',
      'docker compose -f ../../infra/docker/docker-compose.yml down',
      '```',
    )
  }

  sections.push(
    '',
    '## Próximo passo recomendado',
    withFirebase
      ? '- Usar custom claims do Firebase para papéis e adicionar testes de integração.'
      : '- Adicionar refresh token, autorização por papéis e testes de integração.',
  )

  return `${sections.join('\n')}\n`
}

// O contexto do build é a raiz do monorepo: o pnpm-lock.yaml fica lá
function getNodeDockerfile(withPostgres: boolean) {
  return `# Build a partir da raiz: docker build -f apps/backend/Dockerfile .
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
${withPostgres ? '# Prisma precisa do OpenSSL\nRUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*\n' : ''}
FROM base AS build
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @apps/backend build
# Cópia isolada do app só com as dependências de produção
RUN pnpm --filter @apps/backend deploy --prod /prod/backend
${withPostgres ? '# O deploy não roda o postinstall: gera o Prisma Client na cópia\nRUN cd /prod/backend && node_modules/.bin/prisma generate\n' : ''}
FROM base
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /prod/backend .
USER node
EXPOSE 3001
${withPostgres ? '# Aplica as migrations commitadas em prisma/migrations antes de subir\nCMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]' : 'CMD ["node", "dist/main.js"]'}
`
}

function getFastApiDockerfile() {
  return `# Build a partir da raiz: docker build -f apps/backend/Dockerfile .
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY apps/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/backend/app ./app
RUN useradd --system app
USER app
EXPOSE 3001
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \${PORT:-3001}"]
`
}

function getPrismaSchema() {
  return `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}
`
}

export function createExpress(projectDir: string, answers: Answers) {
  const backendDir = path.join(projectDir, 'apps', 'backend')
  const withPostgres = usesPostgres(answers)
  const withFirebase = answers.auth === 'firebase'

  const packageJson = {
    name: '@apps/backend',
    private: true,
    type: 'module',
    scripts: {
      dev: 'tsx watch src/main.ts',
      build: 'tsc -p tsconfig.json',
      start: 'node dist/main.js',
      test: 'tsx --test src/**/*.test.ts',
      ...(withPostgres
        ? {
            postinstall: 'prisma generate',
            'db:generate': 'prisma generate',
            'db:migrate': 'prisma migrate dev',
          }
        : {}),
    },
    dependencies: {
      ...(withFirebase
        ? { 'firebase-admin': '^14.5.0' }
        : { bcryptjs: '^2.4.3', jose: '^5.9.6' }),
      cors: '^2.8.5',
      dotenv: '^16.4.7',
      express: '^4.21.2',
      helmet: '^8.0.0',
      'pino-http': '^10.3.0',
      'pino-pretty': '^13.0.0',
      'reflect-metadata': '^0.2.2',
      tsyringe: '^4.8.0',
      zod: '^3.24.1',
      // prisma em dependencies: o container roda prisma migrate deploy
      ...(withPostgres ? { '@prisma/client': '^6.4.1', prisma: '^6.4.1' } : {}),
    },
    devDependencies: {
      ...(withFirebase ? {} : { '@types/bcryptjs': '^2.4.6' }),
      '@types/cors': '^2.8.17',
      '@types/express': '^4.17.21',
      '@types/node': '^22.10.2',
      tsx: '^4.19.2',
      typescript: '^5.7.2',
    },
  }

  writeFile(
    path.join(backendDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
  )

  writeFile(
    path.join(backendDir, 'tsconfig.json'),
    `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "types": ["node"]
  },
  "include": ["src"]
}
`,
  )

  createFiles(backendDir, {
    ...getBackendEnvFiles(answers),
    Dockerfile: getNodeDockerfile(withPostgres),
    'src/main.ts': `import 'reflect-metadata'
import 'dotenv/config'
import { createApp } from './app.js'
import { buildHttpDependencies } from './infra/container/build-http-dependencies.js'
import { loadEnv } from './shared/config/env.js'

const env = loadEnv()
const dependencies = buildHttpDependencies(env)
const app = createApp(env, dependencies.router)

app.listen(env.PORT, () => {
  console.log(
    'API Express pronta em http://localhost:' + env.PORT + '/' + env.GLOBAL_PREFIX,
  )
})
`,
    'src/app.ts': `import express, { type Router } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { errorHandler } from './presentation/http/middlewares/error-handler.js'
import type { AppEnv } from './shared/config/env.js'

export function createApp(env: AppEnv, apiRouter: Router) {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  )
  app.use(
    pinoHttp({
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use('/' + env.GLOBAL_PREFIX, apiRouter)
  app.use(errorHandler)

  return app
}
`,
    'src/shared/config/env.ts': `import { z } from 'zod'

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    GLOBAL_PREFIX: z.string().min(1).default('api'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_NAME: z.string().min(1).default('Create Stack API'),
    CORS_ORIGIN: z
      .string()
      .default('http://localhost:3000,http://localhost:5173')
      .transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean)),
    DATABASE_URL: ${withPostgres ? "z.string().min(1, 'DATABASE_URL é obrigatória quando PostgreSQL está habilitado.')" : 'z.string().optional()'},
${withFirebase ? `    FIREBASE_PROJECT_ID: z
      .string({ required_error: 'FIREBASE_PROJECT_ID é obrigatório (Console do Firebase > Configurações do projeto).' })
      .min(1, 'FIREBASE_PROJECT_ID é obrigatório (Console do Firebase > Configurações do projeto).'),
` : `    JWT_ACCESS_SECRET: z
      .string({ required_error: 'JWT_ACCESS_SECRET é obrigatório (gere com: openssl rand -base64 32).' })
      .min(32, 'JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres (gere com: openssl rand -base64 32).'),
    JWT_ACCESS_EXPIRES_IN: z.string().min(2).default('1d'),
`}  })

export type AppEnv = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsedEnv = envSchema.safeParse(source)

  if (!parsedEnv.success) {
    throw new Error(
      'Falha ao validar variáveis de ambiente do backend Express: ' +
        JSON.stringify(parsedEnv.error.flatten().fieldErrors),
    )
  }

  return parsedEnv.data
}
`,
    'src/shared/errors/app-error.ts': `export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = 'APPLICATION_ERROR',
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
`,
    'src/@types/express/index.d.ts': `declare namespace Express {
  interface Request {
    auth?: import('../../application/security/contracts/token-service.contract.js').AccessTokenPayload
  }
}
`,
    'src/domain/users/entities/user.entity.ts': `export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly createdAt: string,
  ) {}
}
`,
    'src/domain/users/contracts/user-repository.contract.ts': `import { UserEntity } from '../entities/user.entity.js'

export abstract class UserRepositoryContract {
  abstract create(input: {
    name: string
    email: string
    passwordHash: string
  }): Promise<UserEntity>

  abstract findByEmail(email: string): Promise<UserEntity | null>
  abstract findById(id: string): Promise<UserEntity | null>
}
`,
    'src/application/security/contracts/password-hasher.contract.ts': `export abstract class PasswordHasherContract {
  abstract hash(value: string): Promise<string>
  abstract compare(value: string, hash: string): Promise<boolean>
}
`,
    'src/application/security/contracts/token-service.contract.ts': `export type AccessTokenPayload = {
  sub: string
  email: string
}

export abstract class TokenServiceContract {
  abstract signAccessToken(payload: AccessTokenPayload): Promise<string>
  abstract verifyAccessToken(token: string): Promise<AccessTokenPayload>
}
`,
    'src/application/users/dto/register-user.input.ts': `export type RegisterUserInput = {
  name: string
  email: string
  password: string
}
`,
    'src/application/auth/dto/login.input.ts': `export type LoginInput = {
  email: string
  password: string
}
`,
    'src/application/auth/dto/auth.output.ts': `export type AuthOutput = {
  accessToken: string
  user: {
    id: string
    name: string
    email: string
    createdAt: string
  }
}
`,
    'src/application/users/use-cases/register-user.use-case.ts': `import { inject, injectable } from 'tsyringe'
import { AppError } from '../../../shared/errors/app-error.js'
import { UserRepositoryContract } from '../../../domain/users/contracts/user-repository.contract.js'
import { PasswordHasherContract } from '../../security/contracts/password-hasher.contract.js'
import type { RegisterUserInput } from '../dto/register-user.input.js'

@injectable()
export class RegisterUserUseCase {
  constructor(
    @inject('UserRepositoryContract')
    private readonly userRepository: UserRepositoryContract,
    @inject('PasswordHasherContract')
    private readonly passwordHasher: PasswordHasherContract,
  ) {}

  async execute(input: RegisterUserInput) {
    const existingUser = await this.userRepository.findByEmail(input.email)

    if (existingUser) {
      throw new AppError('E-mail já cadastrado.', 409, 'EMAIL_ALREADY_EXISTS')
    }

    const passwordHash = await this.passwordHasher.hash(input.password)
    const user = await this.userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
    })

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    }
  }
}
`,
    'src/application/auth/use-cases/login.use-case.ts': `import { inject, injectable } from 'tsyringe'
import { AppError } from '../../../shared/errors/app-error.js'
import { UserRepositoryContract } from '../../../domain/users/contracts/user-repository.contract.js'
import { PasswordHasherContract } from '../../security/contracts/password-hasher.contract.js'
import { TokenServiceContract } from '../../security/contracts/token-service.contract.js'
import type { LoginInput } from '../dto/login.input.js'
import type { AuthOutput } from '../dto/auth.output.js'

@injectable()
export class LoginUseCase {
  constructor(
    @inject('UserRepositoryContract')
    private readonly userRepository: UserRepositoryContract,
    @inject('PasswordHasherContract')
    private readonly passwordHasher: PasswordHasherContract,
    @inject('TokenServiceContract')
    private readonly tokenService: TokenServiceContract,
  ) {}

  async execute(input: LoginInput): Promise<AuthOutput> {
    const user = await this.userRepository.findByEmail(input.email)

    if (!user) {
      throw new AppError('Credenciais inválidas.', 401, 'INVALID_CREDENTIALS')
    }

    const isPasswordValid = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    )

    if (!isPasswordValid) {
      throw new AppError('Credenciais inválidas.', 401, 'INVALID_CREDENTIALS')
    }

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
    })

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    }
  }
}
`,
    'src/application/users/use-cases/get-current-user.use-case.ts': `import { inject, injectable } from 'tsyringe'
import { AppError } from '../../../shared/errors/app-error.js'
import { UserRepositoryContract } from '../../../domain/users/contracts/user-repository.contract.js'

@injectable()
export class GetCurrentUserUseCase {
  constructor(
    @inject('UserRepositoryContract')
    private readonly userRepository: UserRepositoryContract,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND')
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    }
  }
}
`,
    'src/infra/security/bcrypt-password-hasher.ts': `import bcrypt from 'bcryptjs'
import { injectable } from 'tsyringe'
import { PasswordHasherContract } from '../../application/security/contracts/password-hasher.contract.js'

@injectable()
export class BcryptPasswordHasher implements PasswordHasherContract {
  async hash(value: string) {
    return bcrypt.hash(value, 10)
  }

  async compare(value: string, hash: string) {
    return bcrypt.compare(value, hash)
  }
}
`,
    'src/infra/security/jwt-token.service.ts': `import { jwtVerify, SignJWT } from 'jose'
import type { AccessTokenPayload } from '../../application/security/contracts/token-service.contract.js'
import { TokenServiceContract } from '../../application/security/contracts/token-service.contract.js'
import { AppError } from '../../shared/errors/app-error.js'
import type { AppEnv } from '../../shared/config/env.js'

export class JwtTokenService implements TokenServiceContract {
  private readonly secret: Uint8Array

  constructor(
    private readonly env: Pick<AppEnv, 'JWT_ACCESS_SECRET' | 'JWT_ACCESS_EXPIRES_IN'>,
  ) {
    this.secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET)
  }

  async signAccessToken(payload: AccessTokenPayload) {
    return new SignJWT({ email: payload.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(this.env.JWT_ACCESS_EXPIRES_IN)
      .sign(this.secret)
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret)

      if (!payload.sub || typeof payload.email !== 'string') {
        throw new AppError('Token inválido.', 401, 'INVALID_TOKEN')
      }

      return {
        sub: String(payload.sub),
        email: payload.email,
      }
    } catch {
      throw new AppError('Token inválido ou expirado.', 401, 'INVALID_TOKEN')
    }
  }
}
`,
    'src/infra/repositories/in-memory-user.repository.ts': `import { injectable } from 'tsyringe'
import { UserRepositoryContract } from '../../domain/users/contracts/user-repository.contract.js'
import { UserEntity } from '../../domain/users/entities/user.entity.js'

@injectable()
export class InMemoryUserRepository implements UserRepositoryContract {
  private static readonly users = new Map<string, UserEntity>()

  async create(input: { name: string; email: string; passwordHash: string }) {
    const user = new UserEntity(
      crypto.randomUUID(),
      input.name,
      input.email,
      input.passwordHash,
      new Date().toISOString(),
    )

    InMemoryUserRepository.users.set(user.id, user)
    return user
  }

  async findByEmail(email: string) {
    return (
      Array.from(InMemoryUserRepository.users.values()).find(
        (user) => user.email === email,
      ) ?? null
    )
  }

  async findById(id: string) {
    return InMemoryUserRepository.users.get(id) ?? null
  }
}
`,
    ...(withPostgres
      ? {
          'prisma/schema.prisma': getPrismaSchema(),
          'src/infra/database/prisma/client.ts': `import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
`,
          'src/infra/repositories/prisma-user.repository.ts': `import { injectable } from 'tsyringe'
import { prisma } from '../database/prisma/client.js'
import { UserRepositoryContract } from '../../domain/users/contracts/user-repository.contract.js'
import { UserEntity } from '../../domain/users/entities/user.entity.js'

@injectable()
export class PrismaUserRepository implements UserRepositoryContract {
  async create(input: { name: string; email: string; passwordHash: string }) {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
      },
    })

    return new UserEntity(
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.createdAt.toISOString(),
    )
  }

  async findByEmail(email: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return null

    return new UserEntity(
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.createdAt.toISOString(),
    )
  }

  async findById(id: string) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return null

    return new UserEntity(
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.createdAt.toISOString(),
    )
  }
}
`,
        }
      : {}),
    'src/infra/container/build-http-dependencies.ts': `import { Router } from 'express'
import { container, type DependencyContainer } from 'tsyringe'
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case.js'
import { PasswordHasherContract } from '../../application/security/contracts/password-hasher.contract.js'
import { TokenServiceContract } from '../../application/security/contracts/token-service.contract.js'
import { GetCurrentUserUseCase } from '../../application/users/use-cases/get-current-user.use-case.js'
import { RegisterUserUseCase } from '../../application/users/use-cases/register-user.use-case.js'
import { UserRepositoryContract } from '../../domain/users/contracts/user-repository.contract.js'
import { BcryptPasswordHasher } from '../security/bcrypt-password-hasher.js'
import { JwtTokenService } from '../security/jwt-token.service.js'
import type { AppEnv } from '../../shared/config/env.js'
import { AuthController } from '../../presentation/http/controllers/auth.controller.js'
import { HealthController } from '../../presentation/http/controllers/health.controller.js'
import { UsersController } from '../../presentation/http/controllers/users.controller.js'
import { createAuthMiddleware } from '../../presentation/http/middlewares/auth-middleware.js'
import { createApiRouter } from '../../presentation/http/routes/index.js'
${withPostgres ? "import { PrismaUserRepository } from '../repositories/prisma-user.repository.js'" : "import { InMemoryUserRepository } from '../repositories/in-memory-user.repository.js'"}

function buildContainer(env: AppEnv): DependencyContainer {
  const scopedContainer = container.createChildContainer()

  scopedContainer.registerSingleton(RegisterUserUseCase, RegisterUserUseCase)
  scopedContainer.registerSingleton(LoginUseCase, LoginUseCase)
  scopedContainer.registerSingleton(GetCurrentUserUseCase, GetCurrentUserUseCase)
  scopedContainer.registerSingleton<PasswordHasherContract>(
    'PasswordHasherContract',
    BcryptPasswordHasher,
  )
  scopedContainer.register<TokenServiceContract>('TokenServiceContract', {
    useValue: new JwtTokenService(env),
  })
  scopedContainer.registerSingleton<UserRepositoryContract>(
    'UserRepositoryContract',
    ${withPostgres ? 'PrismaUserRepository' : 'InMemoryUserRepository'},
  )

  return scopedContainer
}

export function buildHttpDependencies(env: AppEnv): { router: Router } {
  const scopedContainer = buildContainer(env)
  const authController = new AuthController(
    scopedContainer.resolve(RegisterUserUseCase),
    scopedContainer.resolve(LoginUseCase),
  )
  const usersController = new UsersController(
    scopedContainer.resolve(GetCurrentUserUseCase),
  )
  const healthController = new HealthController()
  const authMiddleware = createAuthMiddleware(
    scopedContainer.resolve<TokenServiceContract>('TokenServiceContract'),
  )

  return {
    router: createApiRouter({
      authController,
      usersController,
      healthController,
      authMiddleware,
    }),
  }
}
`,
    'src/presentation/http/schemas/register-user.schema.ts': `import { z } from 'zod'

export const registerUserSchema = {
  body: z.object({
    name: z.string().trim().min(3, 'Informe um nome com ao menos 3 caracteres.'),
    email: z.string().trim().email('Informe um e-mail válido.'),
    password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.'),
  }),
}
`,
    'src/presentation/http/schemas/login.schema.ts': `import { z } from 'zod'

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email('Informe um e-mail válido.'),
    password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.'),
  }),
}
`,
    'src/presentation/http/middlewares/validate-request.ts': `import type { NextFunction, Request, Response } from 'express'
import { ZodError, type ZodSchema } from 'zod'
import { AppError } from '../../../shared/errors/app-error.js'

export function validateRequest(schema: {
  body?: ZodSchema
  query?: ZodSchema
  params?: ZodSchema
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body)
      if (schema.query) req.query = schema.query.parse(req.query)
      if (schema.params) req.params = schema.params.parse(req.params)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        next(new AppError('Payload inválido.', 422, 'VALIDATION_ERROR', error.flatten()))
        return
      }

      next(error)
    }
  }
}
`,
    'src/presentation/http/middlewares/error-handler.ts': `import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../../../shared/errors/app-error.js'

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
      details: error.details,
    })
    return
  }

  console.error(error)

  res.status(500).json({
    message: 'Erro interno não tratado.',
    code: 'INTERNAL_SERVER_ERROR',
  })
}
`,
    'src/presentation/http/middlewares/async-handler.ts': `import type { NextFunction, Request, RequestHandler, Response } from 'express'

export function asyncHandler(handler: RequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}
`,
    'src/presentation/http/middlewares/auth-middleware.ts': `import type { NextFunction, Request, Response } from 'express'
import { TokenServiceContract } from '../../../application/security/contracts/token-service.contract.js'
import { AppError } from '../../../shared/errors/app-error.js'

export function createAuthMiddleware(tokenService: TokenServiceContract) {
  return async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ) {
    const authorization = req.headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
      next(new AppError('Token ausente.', 401, 'MISSING_TOKEN'))
      return
    }

    const token = authorization.replace('Bearer ', '').trim()
    const payload = await tokenService.verifyAccessToken(token)

    req.auth = payload
    next()
  }
}
`,
    'src/presentation/http/controllers/health.controller.ts': `import type { Request, Response } from 'express'

export class HealthController {
  handle(_req: Request, res: Response) {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() })
  }
}
`,
    'src/presentation/http/controllers/auth.controller.ts': `import type { Request, Response } from 'express'
import { LoginUseCase } from '../../../application/auth/use-cases/login.use-case.js'
import { RegisterUserUseCase } from '../../../application/users/use-cases/register-user.use-case.js'

export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  async register(req: Request, res: Response) {
    const result = await this.registerUserUseCase.execute(req.body)
    return res.status(201).json(result)
  }

  async login(req: Request, res: Response) {
    const result = await this.loginUseCase.execute(req.body)
    return res.status(200).json(result)
  }
}
`,
    'src/presentation/http/controllers/users.controller.ts': `import type { Request, Response } from 'express'
import { GetCurrentUserUseCase } from '../../../application/users/use-cases/get-current-user.use-case.js'

export class UsersController {
  constructor(private readonly getCurrentUserUseCase: GetCurrentUserUseCase) {}

  async me(req: Request, res: Response) {
    const result = await this.getCurrentUserUseCase.execute(req.auth!.sub)
    return res.status(200).json(result)
  }
}
`,
    'src/presentation/http/routes/index.ts': `import { Router, type RequestHandler } from 'express'
import { AuthController } from '../controllers/auth.controller.js'
import { HealthController } from '../controllers/health.controller.js'
import { UsersController } from '../controllers/users.controller.js'
import { asyncHandler } from '../middlewares/async-handler.js'
import { validateRequest } from '../middlewares/validate-request.js'
import { loginSchema } from '../schemas/login.schema.js'
import { registerUserSchema } from '../schemas/register-user.schema.js'

type CreateApiRouterInput = {
  authController: AuthController
  usersController: UsersController
  healthController: HealthController
  authMiddleware: RequestHandler
}

export function createApiRouter({
  authController,
  usersController,
  healthController,
  authMiddleware,
}: CreateApiRouterInput) {
  const router = Router()

  router.get('/health', (req, res) => healthController.handle(req, res))
  router.post(
    '/auth/register',
    validateRequest(registerUserSchema),
    asyncHandler((req, res) => authController.register(req, res)),
  )
  router.post(
    '/auth/login',
    validateRequest(loginSchema),
    asyncHandler((req, res) => authController.login(req, res)),
  )
  router.get(
    '/users/me',
    asyncHandler(authMiddleware),
    asyncHandler((req, res) => usersController.me(req, res)),
  )

  return router
}
`,
    'README.md': getBackendReadme(
      'Backend Express',
      withPostgres ? 'Prisma + PostgreSQL' : 'Repositório em memória',
      answers,
      [
        '```bash',
        'pnpm install',
        ...(withPostgres ? ['pnpm db:migrate'] : []),
        'pnpm dev',
        '```',
      ],
    ),
  }, withFirebase ? expressFirebaseOverlay(answers) : {})
}

export function createNest(projectDir: string, answers: Answers) {
  const backendDir = path.join(projectDir, 'apps', 'backend')
  const withPostgres = usesPostgres(answers)
  const withFirebase = answers.auth === 'firebase'

  const packageJson = {
    name: '@apps/backend',
    private: true,
    type: 'module',
    // Nest depende de emitDecoratorMetadata: tsx/esbuild não emite, então dev e test usam tsc
    scripts: {
      dev: 'tsc-watch -p tsconfig.json --onSuccess "node dist/main.js"',
      build: 'tsc -p tsconfig.json',
      start: 'node dist/main.js',
      test: 'tsc -p tsconfig.json && node --test "dist/**/*.test.js"',
      ...(withPostgres
        ? {
            postinstall: 'prisma generate',
            'db:generate': 'prisma generate',
            'db:migrate': 'prisma migrate dev',
          }
        : {}),
    },
    dependencies: {
      '@nestjs/common': '^11.0.3',
      '@nestjs/core': '^11.0.3',
      '@nestjs/platform-express': '^11.0.3',
      ...(withFirebase
        ? { 'firebase-admin': '^14.5.0' }
        : { bcryptjs: '^2.4.3', jose: '^5.9.6' }),
      'class-transformer': '^0.5.1',
      'class-validator': '^0.14.1',
      dotenv: '^16.4.7',
      helmet: '^8.0.0',
      'reflect-metadata': '^0.2.2',
      rxjs: '^7.8.1',
      // prisma em dependencies: o container roda prisma migrate deploy
      ...(withPostgres ? { '@prisma/client': '^6.4.1', prisma: '^6.4.1' } : {}),
    },
    devDependencies: {
      '@nestjs/testing': '^11.0.3',
      ...(withFirebase ? {} : { '@types/bcryptjs': '^2.4.6' }),
      '@types/express': '^5.0.0',
      '@types/node': '^22.10.2',
      '@types/supertest': '^6.0.3',
      supertest: '^7.1.0',
      'tsc-watch': '^7.2.1',
      typescript: '^5.7.2',
    },
  }

  writeFile(
    path.join(backendDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
  )

  writeFile(
    path.join(backendDir, 'tsconfig.json'),
    `{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "dist",
    "rootDir": "src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
`,
  )

  createFiles(backendDir, {
    ...getBackendEnvFiles(answers),
    Dockerfile: getNodeDockerfile(withPostgres),
    'src/bootstrap/configure-app.ts': `import helmet from 'helmet'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { AppExceptionFilter } from '../presentation/http/filters/app-exception.filter.js'
import type { Env } from '../shared/config/env.js'

export function configureApp(app: INestApplication, env: Env) {
  app.use(helmet())
  app.enableCors({
    origin: env.corsOrigin,
    credentials: true,
  })
  app.setGlobalPrefix(env.globalPrefix)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  app.useGlobalFilters(new AppExceptionFilter())

  return app
}
`,
    'src/main.ts': `import 'reflect-metadata'
import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { configureApp } from './bootstrap/configure-app.js'
import { loadEnv } from './shared/config/env.js'

async function bootstrap() {
  const env = loadEnv()
  const app = await NestFactory.create(AppModule)
  configureApp(app, env)

  await app.listen(env.port)

  console.log('API Nest pronta em http://localhost:' + env.port + '/' + env.globalPrefix)
}

bootstrap()
`,
    'src/shared/config/env.ts': `export type Env = {
  port: number
  globalPrefix: string
  nodeEnv: 'development' | 'test' | 'production'
  appName: string
  corsOrigin: string[]
  databaseUrl?: string
${withFirebase ? '  firebaseProjectId: string' : '  jwtAccessSecret: string\n  jwtAccessExpiresIn: string'}
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const port = Number(source.PORT ?? 3001)
${withFirebase ? `  const firebaseProjectId = source.FIREBASE_PROJECT_ID ?? ''

  assert(Number.isFinite(port) && port > 0, 'PORT deve ser um número válido.')
  assert(
    firebaseProjectId,
    'FIREBASE_PROJECT_ID é obrigatório (Console do Firebase > Configurações do projeto).',
  )
` : `  const jwtAccessSecret = source.JWT_ACCESS_SECRET ?? ''

  assert(Number.isFinite(port) && port > 0, 'PORT deve ser um número válido.')
  assert(
    jwtAccessSecret.length >= 32,
    'JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres (gere com: openssl rand -base64 32).',
  )
`}
  const databaseUrl = source.DATABASE_URL
${withPostgres ? "  assert(databaseUrl, 'DATABASE_URL é obrigatória quando PostgreSQL está habilitado.')\n" : ''}
  return {
    port,
    globalPrefix: source.GLOBAL_PREFIX ?? 'api',
    nodeEnv: (source.NODE_ENV as Env['nodeEnv']) ?? 'development',
    appName: source.APP_NAME ?? 'Create Stack API',
    corsOrigin: (source.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:5173')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    databaseUrl,
${withFirebase ? '    firebaseProjectId,' : "    jwtAccessSecret,\n    jwtAccessExpiresIn: source.JWT_ACCESS_EXPIRES_IN ?? '1d',"}
  }
}
`,
    'src/shared/errors/app-error.ts': `export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = 'APPLICATION_ERROR',
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
`,
    'src/app.module.ts': `import { Module } from '@nestjs/common'
import { AuthModule } from './modules/auth/auth.module.js'
import { HealthModule } from './modules/health/health.module.js'
import { UsersModule } from './modules/users/users.module.js'

@Module({
  imports: [HealthModule, AuthModule, UsersModule],
})
export class AppModule {}
`,
    'src/domain/users/entities/user.entity.ts': `export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly createdAt: string,
  ) {}
}
`,
    'src/domain/users/contracts/user-repository.contract.ts': `import { UserEntity } from '../entities/user.entity.js'

export abstract class UserRepositoryContract {
  abstract create(input: {
    name: string
    email: string
    passwordHash: string
  }): Promise<UserEntity>

  abstract findByEmail(email: string): Promise<UserEntity | null>
  abstract findById(id: string): Promise<UserEntity | null>
}
`,
    'src/application/security/contracts/password-hasher.contract.ts': `export abstract class PasswordHasherContract {
  abstract hash(value: string): Promise<string>
  abstract compare(value: string, hash: string): Promise<boolean>
}
`,
    'src/application/security/contracts/token-service.contract.ts': `export type AccessTokenPayload = {
  sub: string
  email: string
}

export abstract class TokenServiceContract {
  abstract signAccessToken(payload: AccessTokenPayload): Promise<string>
  abstract verifyAccessToken(token: string): Promise<AccessTokenPayload>
}
`,
    'src/application/users/use-cases/register-user.use-case.ts': `import { Inject, Injectable } from '@nestjs/common'
import { AppError } from '../../../shared/errors/app-error.js'
import { UserRepositoryContract } from '../../../domain/users/contracts/user-repository.contract.js'
import { PasswordHasherContract } from '../../security/contracts/password-hasher.contract.js'

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject('UserRepositoryContract')
    private readonly userRepository: UserRepositoryContract,
    @Inject('PasswordHasherContract')
    private readonly passwordHasher: PasswordHasherContract,
  ) {}

  async execute(input: { name: string; email: string; password: string }) {
    const existingUser = await this.userRepository.findByEmail(input.email)

    if (existingUser) {
      throw new AppError('E-mail já cadastrado.', 409, 'EMAIL_ALREADY_EXISTS')
    }

    const passwordHash = await this.passwordHasher.hash(input.password)
    const user = await this.userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
    })

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    }
  }
}
`,
    'src/application/auth/use-cases/login.use-case.ts': `import { Inject, Injectable } from '@nestjs/common'
import { AppError } from '../../../shared/errors/app-error.js'
import { UserRepositoryContract } from '../../../domain/users/contracts/user-repository.contract.js'
import { PasswordHasherContract } from '../../security/contracts/password-hasher.contract.js'
import { TokenServiceContract } from '../../security/contracts/token-service.contract.js'

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject('UserRepositoryContract')
    private readonly userRepository: UserRepositoryContract,
    @Inject('PasswordHasherContract')
    private readonly passwordHasher: PasswordHasherContract,
    @Inject('TokenServiceContract')
    private readonly tokenService: TokenServiceContract,
  ) {}

  async execute(input: { email: string; password: string }) {
    const user = await this.userRepository.findByEmail(input.email)

    if (!user) {
      throw new AppError('Credenciais inválidas.', 401, 'INVALID_CREDENTIALS')
    }

    const isPasswordValid = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    )

    if (!isPasswordValid) {
      throw new AppError('Credenciais inválidas.', 401, 'INVALID_CREDENTIALS')
    }

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
    })

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    }
  }
}
`,
    'src/application/users/use-cases/get-current-user.use-case.ts': `import { Inject, Injectable } from '@nestjs/common'
import { AppError } from '../../../shared/errors/app-error.js'
import { UserRepositoryContract } from '../../../domain/users/contracts/user-repository.contract.js'

@Injectable()
export class GetCurrentUserUseCase {
  constructor(
    @Inject('UserRepositoryContract')
    private readonly userRepository: UserRepositoryContract,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND')
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    }
  }
}
`,
    'src/infra/security/bcrypt-password-hasher.ts': `import bcrypt from 'bcryptjs'
import { Injectable } from '@nestjs/common'
import { PasswordHasherContract } from '../../application/security/contracts/password-hasher.contract.js'

@Injectable()
export class BcryptPasswordHasher implements PasswordHasherContract {
  async hash(value: string) {
    return bcrypt.hash(value, 10)
  }

  async compare(value: string, hash: string) {
    return bcrypt.compare(value, hash)
  }
}
`,
    'src/infra/security/jwt-token.service.ts': `import { Injectable } from '@nestjs/common'
import { jwtVerify, SignJWT } from 'jose'
import type { AccessTokenPayload } from '../../application/security/contracts/token-service.contract.js'
import { TokenServiceContract } from '../../application/security/contracts/token-service.contract.js'
import { loadEnv } from '../../shared/config/env.js'
import { AppError } from '../../shared/errors/app-error.js'

@Injectable()
export class JwtTokenService implements TokenServiceContract {
  private readonly env = loadEnv()
  private readonly secret = new TextEncoder().encode(this.env.jwtAccessSecret)

  async signAccessToken(payload: AccessTokenPayload) {
    return new SignJWT({ email: payload.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(this.env.jwtAccessExpiresIn)
      .sign(this.secret)
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret)

      if (!payload.sub || typeof payload.email !== 'string') {
        throw new AppError('Token inválido.', 401, 'INVALID_TOKEN')
      }

      return {
        sub: String(payload.sub),
        email: payload.email,
      }
    } catch {
      throw new AppError('Token inválido ou expirado.', 401, 'INVALID_TOKEN')
    }
  }
}
`,
    'src/infra/repositories/in-memory-user.repository.ts': `import { Injectable } from '@nestjs/common'
import { UserRepositoryContract } from '../../domain/users/contracts/user-repository.contract.js'
import { UserEntity } from '../../domain/users/entities/user.entity.js'

@Injectable()
export class InMemoryUserRepository implements UserRepositoryContract {
  private static readonly users = new Map<string, UserEntity>()

  async create(input: { name: string; email: string; passwordHash: string }) {
    const user = new UserEntity(
      crypto.randomUUID(),
      input.name,
      input.email,
      input.passwordHash,
      new Date().toISOString(),
    )

    InMemoryUserRepository.users.set(user.id, user)
    return user
  }

  async findByEmail(email: string) {
    return (
      Array.from(InMemoryUserRepository.users.values()).find(
        (user) => user.email === email,
      ) ?? null
    )
  }

  async findById(id: string) {
    return InMemoryUserRepository.users.get(id) ?? null
  }
}
`,
    ...(withPostgres
      ? {
          'prisma/schema.prisma': getPrismaSchema(),
          'src/infra/database/prisma/client.ts': `import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
`,
          'src/infra/repositories/prisma-user.repository.ts': `import { Injectable } from '@nestjs/common'
import { prisma } from '../database/prisma/client.js'
import { UserRepositoryContract } from '../../domain/users/contracts/user-repository.contract.js'
import { UserEntity } from '../../domain/users/entities/user.entity.js'

@Injectable()
export class PrismaUserRepository implements UserRepositoryContract {
  async create(input: { name: string; email: string; passwordHash: string }) {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
      },
    })

    return new UserEntity(
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.createdAt.toISOString(),
    )
  }

  async findByEmail(email: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return null

    return new UserEntity(
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.createdAt.toISOString(),
    )
  }

  async findById(id: string) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return null

    return new UserEntity(
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.createdAt.toISOString(),
    )
  }
}
`,
        }
      : {}),
    'src/infra/modules/persistence.module.ts': `import { Module } from '@nestjs/common'
${withPostgres ? "import { PrismaUserRepository } from '../repositories/prisma-user.repository.js'" : "import { InMemoryUserRepository } from '../repositories/in-memory-user.repository.js'"}

@Module({
  providers: [
    {
      provide: 'UserRepositoryContract',
      useClass: ${withPostgres ? 'PrismaUserRepository' : 'InMemoryUserRepository'},
    },
  ],
  exports: ['UserRepositoryContract'],
})
export class PersistenceModule {}
`,
    'src/infra/modules/security.module.ts': `import { Module } from '@nestjs/common'
import { BcryptPasswordHasher } from '../security/bcrypt-password-hasher.js'
import { JwtTokenService } from '../security/jwt-token.service.js'

@Module({
  providers: [
    BcryptPasswordHasher,
    JwtTokenService,
    {
      provide: 'PasswordHasherContract',
      useExisting: BcryptPasswordHasher,
    },
    {
      provide: 'TokenServiceContract',
      useExisting: JwtTokenService,
    },
  ],
  exports: ['PasswordHasherContract', 'TokenServiceContract'],
})
export class SecurityModule {}
`,
    'src/presentation/http/dto/register-user.dto.ts': `import { IsEmail, IsString, MinLength } from 'class-validator'

export class RegisterUserDto {
  @IsString()
  @MinLength(3)
  name!: string

  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string
}
`,
    'src/presentation/http/dto/login.dto.ts': `import { IsEmail, IsString, MinLength } from 'class-validator'

export class LoginDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string
}
`,
    'src/presentation/http/filters/app-exception.filter.ts': `import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { AppError } from '../../../shared/errors/app-error.js'

@Catch(AppError)
export class AppExceptionFilter implements ExceptionFilter<AppError> {
  catch(exception: AppError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()

    response.status(exception.statusCode).json({
      type: 'about:blank',
      title: exception.code,
      status: exception.statusCode,
      code: exception.code,
      detail: exception.message,
      details: exception.details,
    })
  }
}
`,
    'src/presentation/http/guards/jwt-auth.guard.ts': `import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { TokenServiceContract } from '../../../application/security/contracts/token-service.contract.js'
import { AppError } from '../../../shared/errors/app-error.js'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject('TokenServiceContract')
    private readonly tokenService: TokenServiceContract,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: { userId: string } }>()
    const authorization = request.headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError('Token ausente.', 401, 'MISSING_TOKEN')
    }

    const token = authorization.replace('Bearer ', '').trim()
    const payload = await this.tokenService.verifyAccessToken(token)

    request.user = { userId: payload.sub }
    return true
  }
}
`,
    'src/presentation/http/controllers/health.controller.ts': `import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  @Get()
  handle() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
`,
    'src/modules/health/health.module.ts': `import { Module } from '@nestjs/common'
import { HealthController } from '../../presentation/http/controllers/health.controller.js'

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
`,
    'src/modules/auth/auth.module.ts': `import { Module } from '@nestjs/common'
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case.js'
import { RegisterUserUseCase } from '../../application/users/use-cases/register-user.use-case.js'
import { PersistenceModule } from '../../infra/modules/persistence.module.js'
import { SecurityModule } from '../../infra/modules/security.module.js'
import { AuthController } from '../../presentation/http/controllers/auth.controller.js'

@Module({
  imports: [PersistenceModule, SecurityModule],
  controllers: [AuthController],
  providers: [RegisterUserUseCase, LoginUseCase],
})
export class AuthModule {}
`,
    'src/modules/users/users.module.ts': `import { Module } from '@nestjs/common'
import { GetCurrentUserUseCase } from '../../application/users/use-cases/get-current-user.use-case.js'
import { PersistenceModule } from '../../infra/modules/persistence.module.js'
import { SecurityModule } from '../../infra/modules/security.module.js'
import { UsersController } from '../../presentation/http/controllers/users.controller.js'
import { JwtAuthGuard } from '../../presentation/http/guards/jwt-auth.guard.js'

@Module({
  imports: [PersistenceModule, SecurityModule],
  controllers: [UsersController],
  providers: [GetCurrentUserUseCase, JwtAuthGuard],
})
export class UsersModule {}
`,
    'src/presentation/http/controllers/auth.controller.ts': `import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { LoginUseCase } from '../../../application/auth/use-cases/login.use-case.js'
import { RegisterUserUseCase } from '../../../application/users/use-cases/register-user.use-case.js'
import { LoginDto } from '../dto/login.dto.js'
import { RegisterUserDto } from '../dto/register-user.dto.js'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  @Post('register')
  register(@Body() body: RegisterUserDto) {
    return this.registerUserUseCase.execute(body)
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.loginUseCase.execute(body)
  }
}
`,
    'src/presentation/http/controllers/users.controller.ts': `import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { GetCurrentUserUseCase } from '../../../application/users/use-cases/get-current-user.use-case.js'
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js'

@Controller('users')
export class UsersController {
  constructor(private readonly getCurrentUserUseCase: GetCurrentUserUseCase) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user?: { userId: string } }) {
    return this.getCurrentUserUseCase.execute(req.user!.userId)
  }
}
`,
    'src/health.e2e.test.ts': `import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { configureApp } from './bootstrap/configure-app.js'
import { AppModule } from './app.module.js'
import { loadEnv } from './shared/config/env.js'

// ||= e não ??=: o Prisma carrega o .env no import e uma variável vazia não conta
${withFirebase ? "process.env.FIREBASE_PROJECT_ID ||= 'demo-test'" : "process.env.JWT_ACCESS_SECRET ||= 'test-secret-with-at-least-32-characters'"}
${withPostgres ? "process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@localhost:5432/app_db'\n" : ''}
describe('Health', () => {
  let app: INestApplication

  before(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app, loadEnv())
    await app.init()
  })

  after(async () => {
    await app.close()
  })

  it('GET /api/health returns ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/health')

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
  })
})
`,
    'README.md': getBackendReadme(
      'Backend NestJS',
      withPostgres ? 'Prisma + PostgreSQL' : 'Repositório em memória',
      answers,
      [
        '```bash',
        'pnpm install',
        ...(withPostgres ? ['pnpm db:migrate'] : []),
        'pnpm test',
        'pnpm dev',
        '```',
      ],
    ),
  }, withFirebase ? nestFirebaseOverlay(answers) : {})
}

export function createFastApi(projectDir: string, answers: Answers) {
  const backendDir = path.join(projectDir, 'apps', 'backend')
  const withPostgres = usesPostgres(answers)
  const withFirebase = answers.auth === 'firebase'
  // ponytail: pins exatos testados juntos; atualize de propósito, não por acidente
  writeFile(
    path.join(backendDir, 'requirements.txt'),
    `${[
      'fastapi==0.143.1',
      'uvicorn[standard]==0.54.0',
      'pydantic-settings==2.16.0',
      'email-validator==2.3.0',
      ...(withFirebase
        ? ['firebase-admin==7.7.0', 'python-dotenv==1.2.4']
        : ['bcrypt==5.0.0', 'pyjwt==2.15.1']),
      ...(withPostgres ? ['sqlalchemy==2.1.4', 'psycopg[binary]==3.3.6'] : []),
    ].join('\n')}\n`,
  )

  writeFile(
    path.join(backendDir, 'requirements-dev.txt'),
    `${[
      '-r requirements.txt',
      'pytest==9.1.1',
      'pytest-cov==7.1.0',
      'httpx==0.28.1',
      'ruff==0.17.0',
      'mypy==2.4.0',
    ].join('\n')}\n`,
  )

  createFiles(backendDir, {
    Dockerfile: getFastApiDockerfile(),
    ...withEnvFiles((secret) => [
      'PORT=3001',
      'API_PREFIX=api',
      'ENVIRONMENT=development',
      'APP_NAME=Create Stack API',
      'CORS_ORIGINS=http://localhost:3000,http://localhost:5173',
      'LOG_LEVEL=INFO',
      ...(withFirebase
        ? getFirebaseEnvLines(answers)
        : [
            '# Gere com: openssl rand -base64 32',
            `JWT_ACCESS_SECRET=${secret}`,
            'JWT_ACCESS_EXPIRES_MINUTES=1440',
          ]),
      ...(withPostgres
        ? ['DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_db']
        : []),
    ]),
    'pyproject.toml': `[project]
name = "backend"
version = "0.1.0"
requires-python = ">=3.12"

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]

[tool.ruff]
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "B"]

[tool.ruff.lint.flake8-bugbear]
extend-immutable-calls = ["fastapi.Depends"]

[tool.mypy]
python_version = "3.12"
warn_return_any = false
warn_unused_configs = true
ignore_missing_imports = true
`,
    'Makefile': `.PHONY: dev test lint format typecheck

dev:
\tuvicorn app.main:app --reload --port 3001

test:
\tpytest

lint:
\truff check .

format:
\truff format .

typecheck:
\tmypy app
`,
    'app/__init__.py': '',
    'app/main.py': `from app.bootstrap.app_factory import create_app

app = create_app()
`,
    'app/bootstrap/__init__.py': '',
    'app/bootstrap/logging.py': `import logging


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format='%(asctime)s %(levelname)s [%(name)s] %(message)s',
    )
`,
    'app/bootstrap/lifespan.py': `from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.bootstrap.container import AppContainer
${withPostgres ? 'from app.infra.database.base import Base\n' : ''}

def create_lifespan(container: AppContainer):
    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
${withPostgres ? `        # ponytail: create_all só cria tabelas novas; adote Alembic quando o schema evoluir
        Base.metadata.create_all(container.engine)
` : ''}        yield
        container.shutdown()

    return lifespan
`,
    'app/bootstrap/container.py': `from __future__ import annotations

from dataclasses import dataclass
from typing import Any

${withFirebase ? '' : 'from app.application.auth.use_cases.login import LoginUseCase\nfrom app.application.security.password_hasher_contract import PasswordHasherContract\n'}from app.application.security.token_service_contract import TokenServiceContract
from app.application.users.use_cases.get_current_user import GetCurrentUserUseCase
${withFirebase ? '' : 'from app.application.users.use_cases.register_user import RegisterUserUseCase\n'}from app.domain.users.contracts.user_repository import UserRepositoryContract
from app.infra.config.settings import Settings
${withPostgres ? "from app.infra.database.session import create_database_runtime\nfrom app.infra.observability.readiness import SqlAlchemyReadinessProbe\nfrom app.infra.repositories.sqlalchemy.user_repository import SqlAlchemyUserRepository" : "from app.infra.observability.readiness import MemoryReadinessProbe\nfrom app.infra.repositories.memory.user_repository import InMemoryUserRepository"}
${withFirebase ? 'from app.infra.security.firebase_token_service import FirebaseTokenService' : 'from app.infra.security.jwt_token_service import JwtTokenService\nfrom app.infra.security.password_hasher import BcryptPasswordHasher'}


@dataclass(slots=True)
class AppContainer:
    settings: Settings
${withFirebase ? '' : '    password_hasher: PasswordHasherContract\n'}    token_service: TokenServiceContract
    readiness_probe: Any
    session_factory: Any = None
    engine: Any = None

    def build_user_repository(self, db_session: Any | None = None) -> UserRepositoryContract:
${withPostgres ? `        if db_session is None:
            raise RuntimeError('Uma sessão de banco é obrigatória com PostgreSQL.')
        return SqlAlchemyUserRepository(db_session)` : '        return InMemoryUserRepository()'}
${withFirebase ? '' : `
    def build_register_user_use_case(self, db_session: Any | None = None) -> RegisterUserUseCase:
        return RegisterUserUseCase(
            self.build_user_repository(db_session),
            self.password_hasher,
        )

    def build_login_use_case(self, db_session: Any | None = None) -> LoginUseCase:
        return LoginUseCase(
            self.build_user_repository(db_session),
            self.password_hasher,
            self.token_service,
        )
`}
    def build_get_current_user_use_case(
        self, db_session: Any | None = None
    ) -> GetCurrentUserUseCase:
        return GetCurrentUserUseCase(self.build_user_repository(db_session))

    def shutdown(self) -> None:
        if self.engine is not None:
            self.engine.dispose()


def build_container(settings: Settings) -> AppContainer:
${withFirebase ? '' : '    password_hasher = BcryptPasswordHasher()\n'}    token_service = ${withFirebase ? 'FirebaseTokenService' : 'JwtTokenService'}(settings)

${withPostgres ? `    engine, session_factory = create_database_runtime(settings)
    readiness_probe = SqlAlchemyReadinessProbe(session_factory)
    return AppContainer(
        settings=settings,
${withFirebase ? '' : '        password_hasher=password_hasher,\n'}        token_service=token_service,
        readiness_probe=readiness_probe,
        session_factory=session_factory,
        engine=engine,
    )` : `    readiness_probe = MemoryReadinessProbe()
    return AppContainer(
        settings=settings,
${withFirebase ? '' : '        password_hasher=password_hasher,\n'}        token_service=token_service,
        readiness_probe=readiness_probe,
    )`}
`,
    'app/bootstrap/app_factory.py': `${withFirebase ? 'from dotenv import load_dotenv\n' : ''}from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.bootstrap.container import build_container
from app.bootstrap.lifespan import create_lifespan
from app.bootstrap.logging import configure_logging
from app.infra.config.settings import get_settings
from app.presentation.http.api import router as api_router
from app.presentation.http.errors.handlers import register_exception_handlers


def create_app() -> FastAPI:
${withFirebase ? '    # Exporta o .env para o ambiente: o SDK do Firebase lê\n    # GOOGLE_APPLICATION_CREDENTIALS e FIREBASE_AUTH_EMULATOR_HOST de lá\n    load_dotenv()\n' : ''}    settings = get_settings()
    configure_logging(settings.log_level)
    container = build_container(settings)

    app = FastAPI(
        title=settings.app_name,
        lifespan=create_lifespan(container),
    )
    app.state.container = container
    register_exception_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )
    app.include_router(api_router, prefix='/' + settings.api_prefix)
    return app
`,
    'app/application/__init__.py': '',
    'app/application/auth/__init__.py': '',
    'app/application/auth/dto/__init__.py': '',
    'app/application/auth/dto/login_command.py': `from dataclasses import dataclass


@dataclass(slots=True)
class LoginCommand:
    email: str
    password: str
`,
    'app/application/auth/dto/auth_result.py': `from dataclasses import dataclass

from app.application.users.dto.user_result import UserResult


@dataclass(slots=True)
class AuthResult:
    access_token: str
    user: UserResult
`,
    'app/application/auth/use_cases/__init__.py': '',
    'app/application/auth/use_cases/login.py': `from app.application.auth.dto.auth_result import AuthResult
from app.application.auth.dto.login_command import LoginCommand
from app.application.security.password_hasher_contract import PasswordHasherContract
from app.application.security.token_service_contract import TokenServiceContract
from app.application.users.dto.user_result import UserResult
from app.domain.users.contracts.user_repository import UserRepositoryContract
from app.shared.errors.app_error import AppError


class LoginUseCase:
    def __init__(
        self,
        user_repository: UserRepositoryContract,
        password_hasher: PasswordHasherContract,
        token_service: TokenServiceContract,
    ):
        self.user_repository = user_repository
        self.password_hasher = password_hasher
        self.token_service = token_service

    def execute(self, command: LoginCommand) -> AuthResult:
        user = self.user_repository.find_by_email(command.email)
        if not user:
            raise AppError('Credenciais inválidas.', status_code=401, code='INVALID_CREDENTIALS')

        is_password_valid = self.password_hasher.compare(command.password, user.password_hash)
        if not is_password_valid:
            raise AppError('Credenciais inválidas.', status_code=401, code='INVALID_CREDENTIALS')

        access_token = self.token_service.sign_access_token(
            {
                'sub': user.id,
                'email': user.email,
            },
        )

        return AuthResult(
            access_token=access_token,
            user=UserResult(
                id=user.id,
                name=user.name,
                email=user.email,
                created_at=user.created_at,
            ),
        )
`,
    'app/application/security/__init__.py': '',
    'app/application/security/password_hasher_contract.py': `from abc import ABC, abstractmethod


class PasswordHasherContract(ABC):
    @abstractmethod
    def hash(self, value: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def compare(self, value: str, hashed_value: str) -> bool:
        raise NotImplementedError
`,
    'app/application/security/token_service_contract.py': `from abc import ABC, abstractmethod


class TokenServiceContract(ABC):
    @abstractmethod
    def sign_access_token(self, payload: dict[str, str]) -> str:
        raise NotImplementedError

    @abstractmethod
    def verify_access_token(self, token: str) -> dict[str, str]:
        raise NotImplementedError
`,
    'app/application/users/__init__.py': '',
    'app/application/users/dto/__init__.py': '',
    'app/application/users/dto/register_user_command.py': `from dataclasses import dataclass


@dataclass(slots=True)
class RegisterUserCommand:
    name: str
    email: str
    password: str
`,
    'app/application/users/dto/user_result.py': `from dataclasses import dataclass


@dataclass(slots=True)
class UserResult:
    id: str
    name: str
    email: str
    created_at: str
`,
    'app/application/users/use_cases/__init__.py': '',
    'app/application/users/use_cases/register_user.py': `from app.application.security.password_hasher_contract import PasswordHasherContract
from app.application.users.dto.register_user_command import RegisterUserCommand
from app.application.users.dto.user_result import UserResult
from app.domain.users.contracts.user_repository import UserRepositoryContract
from app.shared.errors.app_error import AppError


class RegisterUserUseCase:
    def __init__(
        self,
        user_repository: UserRepositoryContract,
        password_hasher: PasswordHasherContract,
    ):
        self.user_repository = user_repository
        self.password_hasher = password_hasher

    def execute(self, command: RegisterUserCommand) -> UserResult:
        existing_user = self.user_repository.find_by_email(command.email)
        if existing_user:
            raise AppError('E-mail já cadastrado.', status_code=409, code='EMAIL_ALREADY_EXISTS')

        password_hash = self.password_hasher.hash(command.password)
        user = self.user_repository.create(
            name=command.name,
            email=command.email,
            password_hash=password_hash,
        )

        return UserResult(
            id=user.id,
            name=user.name,
            email=user.email,
            created_at=user.created_at,
        )
`,
    'app/application/users/use_cases/get_current_user.py': `from app.application.users.dto.user_result import UserResult
from app.domain.users.contracts.user_repository import UserRepositoryContract
from app.shared.errors.app_error import AppError


class GetCurrentUserUseCase:
    def __init__(self, user_repository: UserRepositoryContract):
        self.user_repository = user_repository

    def execute(self, user_id: str) -> UserResult:
        user = self.user_repository.find_by_id(user_id)
        if not user:
            raise AppError('Usuário não encontrado.', status_code=404, code='USER_NOT_FOUND')

        return UserResult(
            id=user.id,
            name=user.name,
            email=user.email,
            created_at=user.created_at,
        )
`,
    'app/domain/__init__.py': '',
    'app/domain/users/__init__.py': '',
    'app/domain/users/contracts/__init__.py': '',
    'app/domain/users/contracts/user_repository.py': `from abc import ABC, abstractmethod

from app.domain.users.entities.user import UserEntity


class UserRepositoryContract(ABC):
    @abstractmethod
    def create(self, *, name: str, email: str, password_hash: str) -> UserEntity:
        raise NotImplementedError

    @abstractmethod
    def find_by_email(self, email: str) -> UserEntity | None:
        raise NotImplementedError

    @abstractmethod
    def find_by_id(self, user_id: str) -> UserEntity | None:
        raise NotImplementedError
`,
    'app/domain/users/entities/__init__.py': '',
    'app/domain/users/entities/user.py': `from dataclasses import dataclass


@dataclass(slots=True)
class UserEntity:
    id: str
    name: str
    email: str
    password_hash: str
    created_at: str
`,
    'app/infra/__init__.py': '',
    'app/infra/config/__init__.py': '',
    'app/infra/config/settings.py': `from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = 'Create Stack API'
    environment: str = 'development'
    api_prefix: str = 'api'
    port: int = 3001
    log_level: str = 'INFO'
    cors_origins: str = 'http://localhost:3000,http://localhost:5173'
${withPostgres ? '    database_url: str\n' : ''}${withFirebase ? '    firebase_project_id: str\n' : '    jwt_access_secret: str\n    jwt_access_expires_minutes: int = 1440\n'}
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    @field_validator('log_level')
    @classmethod
    def validate_log_level(cls, value: str) -> str:
        allowed = {'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'}
        normalized = value.upper()
        if normalized not in allowed:
            raise ValueError('LOG_LEVEL inválido.')
        return normalized

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(',') if item.strip()]

    @model_validator(mode='after')
    def validate_dependencies(self):
${withFirebase ? `        if not self.firebase_project_id:
            raise ValueError(
                'FIREBASE_PROJECT_ID é obrigatório '
                '(Console do Firebase > Configurações do projeto).'
            )
` : `        if len(self.jwt_access_secret) < 32:
            raise ValueError(
                'JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres '
                '(gere com: openssl rand -base64 32).'
            )

        if self.jwt_access_expires_minutes <= 0:
            raise ValueError('JWT_ACCESS_EXPIRES_MINUTES deve ser maior que zero.')
`}
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
`,
    ...(withPostgres
      ? {
          'app/infra/database/__init__.py': '',
          'app/infra/database/base.py': `from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
`,
          'app/infra/database/session.py': `from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.infra.config.settings import Settings


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith('postgresql://'):
        return database_url.replace('postgresql://', 'postgresql+psycopg://', 1)
    return database_url


def create_database_runtime(settings: Settings):
    engine = create_engine(normalize_database_url(settings.database_url), echo=False)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return engine, session_factory
`,
          'app/infra/database/models/__init__.py': '',
          'app/infra/database/models/user_model.py': `from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.database.base import Base


class UserModel(Base):
    __tablename__ = 'users'

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
`,
          'app/infra/database/README.md': `As tabelas são criadas no startup via \`Base.metadata.create_all\` (ver \`app/bootstrap/lifespan.py\`).

Quando o schema começar a evoluir, adote Alembic:

\`\`\`bash
pip install alembic
alembic init migrations
alembic revision --autogenerate -m "init"
alembic upgrade head
\`\`\`

Depois remova o \`create_all\` do lifespan.
`,
        }
      : {
          'app/infra/database/README.md': 'Persistência em memória habilitada neste scaffold.\n',
        }),
    'app/infra/observability/__init__.py': '',
    'app/infra/observability/readiness.py': `from dataclasses import dataclass
${withPostgres ? '\nfrom sqlalchemy import text\n' : ''}

@dataclass(slots=True)
class ReadinessStatus:
    ok: bool
    detail: str


class MemoryReadinessProbe:
    def check(self) -> ReadinessStatus:
        return ReadinessStatus(ok=True, detail='memory-ready')
${withPostgres ? `

class SqlAlchemyReadinessProbe:
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def check(self) -> ReadinessStatus:
        try:
            with self.session_factory() as session:
                session.execute(text('SELECT 1'))
            return ReadinessStatus(ok=True, detail='postgres-ready')
        except Exception:
            return ReadinessStatus(ok=False, detail='postgres-unavailable')
` : ''}`,
    'app/infra/repositories/__init__.py': '',
    'app/infra/repositories/memory/__init__.py': '',
    'app/infra/repositories/memory/user_repository.py': `from datetime import datetime, timezone
from uuid import uuid4

from app.domain.users.contracts.user_repository import UserRepositoryContract
from app.domain.users.entities.user import UserEntity


class InMemoryUserRepository(UserRepositoryContract):
    _users: dict[str, UserEntity] = {}

    def create(self, *, name: str, email: str, password_hash: str) -> UserEntity:
        user = UserEntity(
            id=str(uuid4()),
            name=name,
            email=email,
            password_hash=password_hash,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._users[user.id] = user
        return user

    def find_by_email(self, email: str) -> UserEntity | None:
        return next((user for user in self._users.values() if user.email == email), None)

    def find_by_id(self, user_id: str) -> UserEntity | None:
        return self._users.get(user_id)
`,
    ...(withPostgres
      ? {
          'app/infra/repositories/sqlalchemy/__init__.py': '',
          'app/infra/repositories/sqlalchemy/user_repository.py': `from sqlalchemy.orm import Session

from app.domain.users.contracts.user_repository import UserRepositoryContract
from app.domain.users.entities.user import UserEntity
from app.infra.database.models.user_model import UserModel


class SqlAlchemyUserRepository(UserRepositoryContract):
    def __init__(self, session: Session):
        self.session = session

    def create(self, *, name: str, email: str, password_hash: str) -> UserEntity:
        model = UserModel(
            name=name,
            email=email,
            password_hash=password_hash,
        )
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return UserEntity(
            id=model.id,
            name=model.name,
            email=model.email,
            password_hash=model.password_hash,
            created_at=model.created_at.isoformat(),
        )

    def find_by_email(self, email: str) -> UserEntity | None:
        model = self.session.query(UserModel).filter(UserModel.email == email).one_or_none()
        if not model:
            return None
        return UserEntity(
            id=model.id,
            name=model.name,
            email=model.email,
            password_hash=model.password_hash,
            created_at=model.created_at.isoformat(),
        )

    def find_by_id(self, user_id: str) -> UserEntity | None:
        model = self.session.query(UserModel).filter(UserModel.id == user_id).one_or_none()
        if not model:
            return None
        return UserEntity(
            id=model.id,
            name=model.name,
            email=model.email,
            password_hash=model.password_hash,
            created_at=model.created_at.isoformat(),
        )
`,
        }
      : {}),
    'app/infra/security/password_hasher.py': `import bcrypt

from app.application.security.password_hasher_contract import PasswordHasherContract


def _to_bytes(value: str) -> bytes:
    # bcrypt só usa os primeiros 72 bytes; o bcrypt>=5 lança erro em vez de truncar
    return value.encode()[:72]


class BcryptPasswordHasher(PasswordHasherContract):
    def hash(self, value: str) -> str:
        return bcrypt.hashpw(_to_bytes(value), bcrypt.gensalt()).decode()

    def compare(self, value: str, hashed_value: str) -> bool:
        return bcrypt.checkpw(_to_bytes(value), hashed_value.encode())
`,
    'app/infra/security/jwt_token_service.py': `from datetime import datetime, timedelta, timezone

import jwt

from app.application.security.token_service_contract import TokenServiceContract
from app.infra.config.settings import Settings
from app.shared.errors.app_error import AppError


class JwtTokenService(TokenServiceContract):
    def __init__(self, settings: Settings):
        self.settings = settings

    def sign_access_token(self, payload: dict[str, str]) -> str:
        issued_at = datetime.now(timezone.utc)
        expires_at = issued_at + timedelta(minutes=self.settings.jwt_access_expires_minutes)
        return jwt.encode(
            {
                **payload,
                'iat': int(issued_at.timestamp()),
                'exp': int(expires_at.timestamp()),
            },
            self.settings.jwt_access_secret,
            algorithm='HS256',
        )

    def verify_access_token(self, token: str) -> dict[str, str]:
        try:
            payload = jwt.decode(token, self.settings.jwt_access_secret, algorithms=['HS256'])
        except jwt.InvalidTokenError as error:
            raise AppError(
                'Token inválido ou expirado.', status_code=401, code='INVALID_TOKEN'
            ) from error

        if 'sub' not in payload or 'email' not in payload:
            raise AppError('Token inválido.', status_code=401, code='INVALID_TOKEN')

        return {
            'sub': str(payload['sub']),
            'email': str(payload['email']),
        }
`,
    'app/presentation/__init__.py': '',
    'app/presentation/http/__init__.py': '',
    'app/presentation/http/api.py': `from fastapi import APIRouter

from app.presentation.http.routes.auth import router as auth_router
from app.presentation.http.routes.health import router as health_router
from app.presentation.http.routes.users import router as users_router

router = APIRouter()
router.include_router(health_router)
router.include_router(auth_router)
router.include_router(users_router)
`,
    'app/presentation/http/dependencies/__init__.py': '',
    'app/presentation/http/dependencies/container.py': `from fastapi import Request

from app.bootstrap.container import AppContainer


def get_container(request: Request) -> AppContainer:
    return request.app.state.container
`,
    'app/presentation/http/dependencies/db.py': `from collections.abc import Generator
from typing import Any

from fastapi import Depends

from app.bootstrap.container import AppContainer
from app.presentation.http.dependencies.container import get_container


def get_db_session(
    container: AppContainer = Depends(get_container),
) -> Generator[Any | None, None, None]:
    if container.session_factory is None:
        yield None
        return

    with container.session_factory() as session:
        yield session
`,
    'app/presentation/http/dependencies/use_cases.py': `from typing import Any

from fastapi import Depends

from app.application.auth.use_cases.login import LoginUseCase
from app.application.users.use_cases.get_current_user import GetCurrentUserUseCase
from app.application.users.use_cases.register_user import RegisterUserUseCase
from app.bootstrap.container import AppContainer
from app.presentation.http.dependencies.container import get_container
from app.presentation.http.dependencies.db import get_db_session


def get_register_user_use_case(
    container: AppContainer = Depends(get_container),
    db_session: Any | None = Depends(get_db_session),
) -> RegisterUserUseCase:
    return container.build_register_user_use_case(db_session)


def get_login_use_case(
    container: AppContainer = Depends(get_container),
    db_session: Any | None = Depends(get_db_session),
) -> LoginUseCase:
    return container.build_login_use_case(db_session)


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


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    container: AppContainer = Depends(get_container),
) -> str:
    if not credentials:
        raise AppError('Token ausente.', status_code=401, code='MISSING_TOKEN')

    payload = container.token_service.verify_access_token(credentials.credentials)
    return payload['sub']
`,
    'app/presentation/http/routes/__init__.py': '',
    'app/presentation/http/errors/__init__.py': '',
    'app/presentation/http/errors/problem_details.py': `def build_problem_details(
    *,
    status: int,
    title: str,
    code: str,
    detail: str,
    type_: str = 'about:blank',
):
    return {
        'type': type_,
        'title': title,
        'status': status,
        'code': code,
        'detail': detail,
    }
`,
    'app/presentation/http/errors/handlers.py': `from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.presentation.http.errors.problem_details import build_problem_details
from app.shared.errors.app_error import AppError


def register_exception_handlers(app: FastAPI):
    @app.exception_handler(AppError)
    async def handle_application_error(_request: Request, error: AppError):
        return JSONResponse(
            status_code=error.status_code,
            content=build_problem_details(
                status=error.status_code,
                title='Application Error',
                code=error.code,
                detail=error.message,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_request: Request, error: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=build_problem_details(
                status=422,
                title='Validation Error',
                code='VALIDATION_ERROR',
                detail='Payload inválido.',
            )
            | {'errors': error.errors()},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, _error: Exception):
        return JSONResponse(
            status_code=500,
            content=build_problem_details(
                status=500,
                title='Internal Server Error',
                code='INTERNAL_SERVER_ERROR',
                detail='Erro interno não tratado.',
            ),
        )
`,
    'app/presentation/http/schemas/__init__.py': '',
    'app/presentation/http/schemas/auth.py': `from pydantic import BaseModel, EmailStr, Field


class RegisterUserBody(BaseModel):
    name: str = Field(min_length=3)
    email: EmailStr
    password: str = Field(min_length=8)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    created_at: str


class AuthResponse(BaseModel):
    access_token: str
    user: UserResponse
`,
    'app/presentation/http/schemas/health.py': `from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    detail: str
`,
    'app/presentation/http/routes/health.py': `from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.bootstrap.container import AppContainer
from app.presentation.http.dependencies.container import get_container
from app.presentation.http.schemas.health import HealthResponse

router = APIRouter(prefix='/health', tags=['health'])


@router.get('/live', response_model=HealthResponse)
def live() -> HealthResponse:
    return HealthResponse(status='ok', detail='process-alive')


@router.get('/ready', response_model=HealthResponse)
def ready(
    container: AppContainer = Depends(get_container),
):
    readiness = container.readiness_probe.check()
    response = HealthResponse(
        status='ok' if readiness.ok else 'degraded',
        detail=readiness.detail,
    )
    if readiness.ok:
        return response

    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content=response.model_dump(),
    )
`,
    'app/presentation/http/routes/auth.py': `from fastapi import APIRouter, Depends, status

from app.application.auth.dto.login_command import LoginCommand
from app.application.auth.use_cases.login import LoginUseCase
from app.application.users.dto.register_user_command import RegisterUserCommand
from app.application.users.use_cases.register_user import RegisterUserUseCase
from app.presentation.http.dependencies.use_cases import (
    get_login_use_case,
    get_register_user_use_case,
)
from app.presentation.http.schemas.auth import (
    AuthResponse,
    LoginBody,
    RegisterUserBody,
    UserResponse,
)

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/register', response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterUserBody,
    use_case: RegisterUserUseCase = Depends(get_register_user_use_case),
) -> UserResponse:
    result = use_case.execute(
        RegisterUserCommand(
            name=body.name,
            email=str(body.email),
            password=body.password,
        ),
    )
    return UserResponse(
        id=result.id,
        name=result.name,
        email=result.email,
        created_at=result.created_at,
    )


@router.post('/login', response_model=AuthResponse)
def login(
    body: LoginBody,
    use_case: LoginUseCase = Depends(get_login_use_case),
) -> AuthResponse:
    result = use_case.execute(
        LoginCommand(
            email=str(body.email),
            password=body.password,
        ),
    )
    return AuthResponse(
        access_token=result.access_token,
        user=UserResponse(
            id=result.user.id,
            name=result.user.name,
            email=result.user.email,
            created_at=result.user.created_at,
        ),
    )
`,
    'app/presentation/http/routes/users.py': `from fastapi import APIRouter, Depends

from app.application.users.use_cases.get_current_user import GetCurrentUserUseCase
from app.presentation.http.dependencies.auth import get_current_user_id
from app.presentation.http.dependencies.use_cases import get_current_user_use_case
from app.presentation.http.schemas.auth import UserResponse

router = APIRouter(prefix='/users', tags=['users'])


@router.get('/me', response_model=UserResponse)
def get_me(
    user_id: str = Depends(get_current_user_id),
    use_case: GetCurrentUserUseCase = Depends(get_current_user_use_case),
) -> UserResponse:
    result = use_case.execute(user_id)
    return UserResponse(
        id=result.id,
        name=result.name,
        email=result.email,
        created_at=result.created_at,
    )
`,
    'app/shared/__init__.py': '',
    'app/shared/errors/__init__.py': '',
    'app/shared/errors/app_error.py': `class AppError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 400,
        code: str = 'APPLICATION_ERROR',
        details=None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details
`,
    'tests/__init__.py': '',
    'tests/unit/__init__.py': '',
    'tests/e2e/__init__.py': '',
    'tests/unit/test_register_user_use_case.py': `from app.application.users.dto.register_user_command import RegisterUserCommand
from app.application.users.use_cases.register_user import RegisterUserUseCase
from app.infra.repositories.memory.user_repository import InMemoryUserRepository


class FakePasswordHasher:
    def hash(self, value: str) -> str:
        return 'hashed::' + value

    def compare(self, value: str, hashed_value: str) -> bool:
        return hashed_value == 'hashed::' + value


def test_register_user_creates_a_new_user():
    use_case = RegisterUserUseCase(InMemoryUserRepository(), FakePasswordHasher())

    result = use_case.execute(
        RegisterUserCommand(
            name='Antonio',
            email='antonio@example.com',
            password='12345678',
        ),
    )

    assert result.email == 'antonio@example.com'
    assert result.name == 'Antonio'
`,
    'tests/conftest.py': `import os

# Roda antes de importar o app: os testes não dependem do .env local
${withFirebase ? "os.environ.setdefault('FIREBASE_PROJECT_ID', 'demo-test')" : "os.environ.setdefault('JWT_ACCESS_SECRET', 'test-secret-with-at-least-32-characters')"}
${withPostgres ? "os.environ.setdefault('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/app_db')\n" : ''}`,
    'tests/unit/test_password_hasher.py': `from app.infra.security.password_hasher import BcryptPasswordHasher


def test_bcrypt_password_hasher_round_trip():
    hasher = BcryptPasswordHasher()
    hashed = hasher.hash('12345678')

    assert hasher.compare('12345678', hashed)
    assert not hasher.compare('wrong-password', hashed)


def test_bcrypt_password_hasher_accepts_passwords_over_72_bytes():
    hasher = BcryptPasswordHasher()

    assert hasher.compare('é' * 100, hasher.hash('é' * 100))
`,
    'tests/e2e/test_health_live.py': `from fastapi.testclient import TestClient

from app.main import app


def test_live_health_endpoint():
    client = TestClient(app)
    response = client.get('/api/health/live')

    assert response.status_code == 200
    assert response.json()['status'] == 'ok'
`,
    'README.md': getBackendReadme(
      'Backend FastAPI',
      withPostgres ? 'SQLAlchemy + PostgreSQL' : 'Repositório em memória',
      answers,
      [
        '```bash',
        ...(answers.provisionPostgres
          ? ['docker compose -f ../../infra/docker/docker-compose.yml up -d']
          : []),
        '# Requer Python >= 3.12',
        'python3.12 -m venv .venv',
        'source .venv/bin/activate',
        'pip install -r requirements-dev.txt',
        'make test',
        'make dev',
        '```',
      ],
    ),
  }, withFirebase ? fastApiFirebaseOverlay(answers) : {})
}
