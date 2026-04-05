import path from 'node:path'
import { writeFile } from '../utils/fs.js'
import type { Answers } from '../types.js'
import { usesPostgres } from '../types.js'

function createFiles(baseDir: string, files: Record<string, string>) {
  for (const [relativePath, content] of Object.entries(files)) {
    writeFile(path.join(baseDir, relativePath), content)
  }
}

function getBackendEnvExample(answers: Answers) {
  const backendDataLayer = usesPostgres(answers) ? 'postgres' : 'memory'
  const lines = [
    'PORT=3001',
    'GLOBAL_PREFIX=api',
    'NODE_ENV=development',
    'APP_NAME=Create Stack API',
    'CORS_ORIGIN=http://localhost:3000,http://localhost:5173',
    `DATA_LAYER=${backendDataLayer}`,
    'JWT_ACCESS_SECRET=change-this-secret-with-at-least-32-characters',
    'JWT_ACCESS_EXPIRES_IN=1d',
  ]

  if (usesPostgres(answers)) {
    lines.push(
      'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_db',
    )
  }

  return `${lines.join('\n')}\n`
}

function getBackendReadme(
  title: string,
  ormLabel: string,
  answers: Answers,
  runInstructions: string[],
) {
  const backendDataLayer = usesPostgres(answers) ? 'postgres' : 'memory'
  const sections = [
    `# ${title}`,
    '',
    'Estrutura inicial pronta para produção com:',
    '- Clean architecture (`domain`, `application`, `infra`, `presentation`)',
    '- Validação de payload e de ambiente',
    '- JWT para autenticação e proteção de rotas',
    `- ORM/persistência: ${ormLabel}`,
    '',
    '## Recursos habilitados',
    `- Persistência do backend: ${backendDataLayer}`,
    `- PostgreSQL: ${usesPostgres(answers) ? 'sim' : 'não'}`,
    '- Estratégia de auth do backend: JWT próprio',
    '',
    '## Como rodar',
    ...runInstructions,
    '',
    '## Endpoints iniciais',
    '- `GET /api/health`',
    '- `POST /api/auth/register`',
    '- `POST /api/auth/login`',
    '- `GET /api/users/me`',
  ]

  if (usesPostgres(answers)) {
    sections.push('- Execute a migração/generate do ORM antes de subir a aplicação.')
  }

  sections.push(
    '',
    '## Próximo passo recomendado',
    '- Adicionar refresh token, autorização por papéis e testes de integração.',
  )

  return `${sections.join('\n')}\n`
}

function getRuntimeConfigTs(framework: 'express' | 'nestjs') {
  return `export const runtimeConfig = {
  framework: '${framework}',
  authStrategy: 'jwt',
} as const
`
}

function getRuntimeConfigPy() {
  return `RUNTIME_CONFIG = {
    'framework': 'fastapi',
    'auth_strategy': 'jwt',
}
`
}

function getPrismaSchema() {
  return `generator client {
  provider = 'prisma-client-js'
}

datasource db {
  provider = 'postgresql'
  url      = env('DATABASE_URL')
}

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  dataLayer    String
  createdAt    DateTime @default(now())
}
`
}

export function createExpress(projectDir: string, answers: Answers) {
  const backendDir = path.join(projectDir, 'apps', 'backend')
  const withPostgres = usesPostgres(answers)

  const packageJson = {
    name: '@apps/backend',
    private: true,
    type: 'module',
    scripts: {
      dev: 'tsx watch src/main.ts',
      build: 'tsc -p tsconfig.json',
      start: 'node dist/main.js',
      ...(withPostgres
        ? {
            'db:generate': 'prisma generate',
            'db:migrate': 'prisma migrate dev',
          }
        : {}),
    },
    dependencies: {
      bcryptjs: '^2.4.3',
      cors: '^2.8.5',
      dotenv: '^16.4.7',
      express: '^4.21.2',
      helmet: '^8.0.0',
      jose: '^5.9.6',
      'pino-http': '^10.3.0',
      'pino-pretty': '^13.0.0',
      'reflect-metadata': '^0.2.2',
      tsyringe: '^4.8.0',
      zod: '^3.24.1',
      ...(withPostgres ? { '@prisma/client': '^6.4.1' } : {}),
    },
    devDependencies: {
      '@types/bcryptjs': '^2.4.6',
      '@types/cors': '^2.8.17',
      '@types/express': '^5.0.0',
      '@types/node': '^22.10.2',
      prisma: '^6.4.1',
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
    '.env.example': getBackendEnvExample(answers),
    'src/shared/config/runtime.ts': getRuntimeConfigTs('express'),
    'src/main.ts': `import 'reflect-metadata'
import 'dotenv/config'
import { createApp } from './app.js'
import { env } from './shared/config/env.js'

const app = createApp()

app.listen(env.PORT, () => {
  console.log(
    'API Express pronta em http://localhost:' + env.PORT + '/' + env.GLOBAL_PREFIX,
  )
})
`,
    'src/app.ts': `import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import './infra/container/index.js'
import { apiRouter } from './presentation/http/routes/index.js'
import { errorHandler } from './presentation/http/middlewares/error-handler.js'
import { env } from './shared/config/env.js'

export function createApp() {
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
    DATA_LAYER: z.enum(['memory', 'postgres']).default('${withPostgres ? 'postgres' : 'memory'}'),
    DATABASE_URL: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres.'),
    JWT_ACCESS_EXPIRES_IN: z.string().min(2).default('1d'),
  })
  .superRefine((value, ctx) => {
    if (${withPostgres} && !value.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL é obrigatória quando PostgreSQL está habilitado.',
      })
    }
  })

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('Falha ao validar variáveis de ambiente do backend Express.')
  console.error(parsedEnv.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsedEnv.data
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
    auth?: {
      userId: string
    }
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
    public readonly dataLayer: string,
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
    dataLayer: string
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
      dataLayer: user.dataLayer,
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
        dataLayer: user.dataLayer,
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
      dataLayer: user.dataLayer,
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
import { injectable } from 'tsyringe'
import type { AccessTokenPayload } from '../../application/security/contracts/token-service.contract.js'
import { TokenServiceContract } from '../../application/security/contracts/token-service.contract.js'
import { AppError } from '../../shared/errors/app-error.js'
import { env } from '../../shared/config/env.js'

@injectable()
export class JwtTokenService implements TokenServiceContract {
  private readonly secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET)

  async signAccessToken(payload: AccessTokenPayload) {
    return new SignJWT({ email: payload.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
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
import { env } from '../../shared/config/env.js'

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
      env.DATA_LAYER,
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
import { env } from '../../shared/config/env.js'

@injectable()
export class PrismaUserRepository implements UserRepositoryContract {
  async create(input: { name: string; email: string; passwordHash: string }) {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        dataLayer: env.DATA_LAYER,
      },
    })

    return new UserEntity(
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.createdAt.toISOString(),
      user.dataLayer,
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
      user.dataLayer,
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
      user.dataLayer,
    )
  }
}
`,
        }
      : {}),
    'src/infra/container/index.ts': `import { container } from 'tsyringe'
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case.js'
import { PasswordHasherContract } from '../../application/security/contracts/password-hasher.contract.js'
import { TokenServiceContract } from '../../application/security/contracts/token-service.contract.js'
import { GetCurrentUserUseCase } from '../../application/users/use-cases/get-current-user.use-case.js'
import { RegisterUserUseCase } from '../../application/users/use-cases/register-user.use-case.js'
import { UserRepositoryContract } from '../../domain/users/contracts/user-repository.contract.js'
import { BcryptPasswordHasher } from '../security/bcrypt-password-hasher.js'
import { JwtTokenService } from '../security/jwt-token.service.js'
${withPostgres ? "import { PrismaUserRepository } from '../repositories/prisma-user.repository.js'" : "import { InMemoryUserRepository } from '../repositories/in-memory-user.repository.js'"}

container.registerSingleton(RegisterUserUseCase, RegisterUserUseCase)
container.registerSingleton(LoginUseCase, LoginUseCase)
container.registerSingleton(GetCurrentUserUseCase, GetCurrentUserUseCase)
container.registerSingleton<PasswordHasherContract>(
  'PasswordHasherContract',
  BcryptPasswordHasher,
)
container.registerSingleton<TokenServiceContract>(
  'TokenServiceContract',
  JwtTokenService,
)
container.registerSingleton<UserRepositoryContract>(
  'UserRepositoryContract',
  ${withPostgres ? 'PrismaUserRepository' : 'InMemoryUserRepository'},
)
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
import { container } from 'tsyringe'
import { TokenServiceContract } from '../../../application/security/contracts/token-service.contract.js'
import { AppError } from '../../../shared/errors/app-error.js'

export async function authMiddleware(
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
  const tokenService = container.resolve<TokenServiceContract>('TokenServiceContract')
  const payload = await tokenService.verifyAccessToken(token)

  req.auth = { userId: payload.sub }
  next()
}
`,
    'src/presentation/http/controllers/health.controller.ts': `import type { Request, Response } from 'express'
import { env } from '../../../shared/config/env.js'
import { runtimeConfig } from '../../../shared/config/runtime.js'

export class HealthController {
  handle(_req: Request, res: Response) {
    return res.json({
      status: 'ok',
      framework: runtimeConfig.framework,
      authStrategy: runtimeConfig.authStrategy,
      dataLayer: env.DATA_LAYER,
      orm: '${withPostgres ? 'prisma' : 'memory'}',
      timestamp: new Date().toISOString(),
    })
  }
}
`,
    'src/presentation/http/controllers/auth.controller.ts': `import type { Request, Response } from 'express'
import { container } from 'tsyringe'
import { LoginUseCase } from '../../../application/auth/use-cases/login.use-case.js'
import { RegisterUserUseCase } from '../../../application/users/use-cases/register-user.use-case.js'

export class AuthController {
  async register(req: Request, res: Response) {
    const useCase = container.resolve(RegisterUserUseCase)
    const result = await useCase.execute(req.body)
    return res.status(201).json(result)
  }

  async login(req: Request, res: Response) {
    const useCase = container.resolve(LoginUseCase)
    const result = await useCase.execute(req.body)
    return res.status(200).json(result)
  }
}
`,
    'src/presentation/http/controllers/users.controller.ts': `import type { Request, Response } from 'express'
import { container } from 'tsyringe'
import { GetCurrentUserUseCase } from '../../../application/users/use-cases/get-current-user.use-case.js'

export class UsersController {
  async me(req: Request, res: Response) {
    const useCase = container.resolve(GetCurrentUserUseCase)
    const result = await useCase.execute(req.auth!.userId)
    return res.status(200).json(result)
  }
}
`,
    'src/presentation/http/routes/index.ts': `import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller.js'
import { HealthController } from '../controllers/health.controller.js'
import { UsersController } from '../controllers/users.controller.js'
import { asyncHandler } from '../middlewares/async-handler.js'
import { authMiddleware } from '../middlewares/auth-middleware.js'
import { validateRequest } from '../middlewares/validate-request.js'
import { loginSchema } from '../schemas/login.schema.js'
import { registerUserSchema } from '../schemas/register-user.schema.js'

const router = Router()
const healthController = new HealthController()
const authController = new AuthController()
const usersController = new UsersController()

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
router.get('/users/me', asyncHandler(authMiddleware), asyncHandler((req, res) => usersController.me(req, res)))

export { router as apiRouter }
`,
    'README.md': getBackendReadme(
      'Backend Express',
      withPostgres ? 'Prisma + PostgreSQL' : 'Repositório em memória',
      answers,
      [
        '```bash',
        'cp .env.example .env',
        'pnpm install',
        ...(withPostgres ? ['pnpm db:generate', 'pnpm db:migrate'] : []),
        'pnpm dev',
        '```',
      ],
    ),
  })
}

export function createNest(projectDir: string, answers: Answers) {
  const backendDir = path.join(projectDir, 'apps', 'backend')
  const withPostgres = usesPostgres(answers)

  const packageJson = {
    name: '@apps/backend',
    private: true,
    type: 'module',
    scripts: {
      dev: 'tsx watch src/main.ts',
      build: 'tsc -p tsconfig.json',
      start: 'node dist/main.js',
      ...(withPostgres
        ? {
            'db:generate': 'prisma generate',
            'db:migrate': 'prisma migrate dev',
          }
        : {}),
    },
    dependencies: {
      '@nestjs/common': '^11.0.3',
      '@nestjs/core': '^11.0.3',
      '@nestjs/platform-express': '^11.0.3',
      bcryptjs: '^2.4.3',
      'class-transformer': '^0.5.1',
      'class-validator': '^0.14.1',
      dotenv: '^16.4.7',
      helmet: '^8.0.0',
      jose: '^5.9.6',
      'reflect-metadata': '^0.2.2',
      rxjs: '^7.8.1',
      ...(withPostgres ? { '@prisma/client': '^6.4.1' } : {}),
    },
    devDependencies: {
      '@types/node': '^22.10.2',
      prisma: '^6.4.1',
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
    '.env.example': getBackendEnvExample(answers),
    'src/shared/config/runtime.ts': getRuntimeConfigTs('nestjs'),
    'src/main.ts': `import 'reflect-metadata'
import 'dotenv/config'
import helmet from 'helmet'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { env } from './shared/config/env.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

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

  await app.listen(env.port)

  console.log('API Nest pronta em http://localhost:' + env.port + '/' + env.globalPrefix)
}

bootstrap()
`,
    'src/shared/config/env.ts': `type DataLayer = 'memory' | 'postgres'

type Env = {
  port: number
  globalPrefix: string
  nodeEnv: 'development' | 'test' | 'production'
  appName: string
  corsOrigin: string[]
  dataLayer: DataLayer
  databaseUrl?: string
  jwtAccessSecret: string
  jwtAccessExpiresIn: string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function parseDataLayer(value: string | undefined): DataLayer {
  const dataLayer = value ?? '${withPostgres ? 'postgres' : 'memory'}'
  assert(['memory', 'postgres'].includes(dataLayer), 'DATA_LAYER inválido.')
  return dataLayer as DataLayer
}

function validateEnv(): Env {
  const dataLayer = parseDataLayer(process.env.DATA_LAYER)
  const port = Number(process.env.PORT ?? 3001)
  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET ?? ''

  assert(Number.isFinite(port) && port > 0, 'PORT deve ser um número válido.')
  assert(jwtAccessSecret.length >= 32, 'JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres.')

  const databaseUrl = process.env.DATABASE_URL
  if (${withPostgres} && !databaseUrl) {
    throw new Error('DATABASE_URL é obrigatória quando PostgreSQL está habilitado.')
  }

  return {
    port,
    globalPrefix: process.env.GLOBAL_PREFIX ?? 'api',
    nodeEnv: (process.env.NODE_ENV as Env['nodeEnv']) ?? 'development',
    appName: process.env.APP_NAME ?? 'Create Stack API',
    corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:5173')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    dataLayer,
    databaseUrl,
    jwtAccessSecret,
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '1d',
  }
}

export const env = validateEnv()
`,
    'src/app.module.ts': `import { Module } from '@nestjs/common'
import { ApplicationCoreModule } from './infra/modules/application-core.module.js'
import { AuthHttpModule } from './presentation/http/modules/auth/auth-http.module.js'
import { HealthHttpModule } from './presentation/http/modules/health/health-http.module.js'
import { UsersHttpModule } from './presentation/http/modules/users/users-http.module.js'

@Module({
  imports: [ApplicationCoreModule, HealthHttpModule, AuthHttpModule, UsersHttpModule],
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
    public readonly dataLayer: string,
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
      dataLayer: user.dataLayer,
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
        dataLayer: user.dataLayer,
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
      dataLayer: user.dataLayer,
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
import { env } from '../../shared/config/env.js'
import { AppError } from '../../shared/errors/app-error.js'

@Injectable()
export class JwtTokenService implements TokenServiceContract {
  private readonly secret = new TextEncoder().encode(env.jwtAccessSecret)

  async signAccessToken(payload: AccessTokenPayload) {
    return new SignJWT({ email: payload.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(env.jwtAccessExpiresIn)
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
import { env } from '../../shared/config/env.js'

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
      env.dataLayer,
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
import { env } from '../../shared/config/env.js'

@Injectable()
export class PrismaUserRepository implements UserRepositoryContract {
  async create(input: { name: string; email: string; passwordHash: string }) {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        dataLayer: env.dataLayer,
      },
    })

    return new UserEntity(
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.createdAt.toISOString(),
      user.dataLayer,
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
      user.dataLayer,
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
      user.dataLayer,
    )
  }
}
`,
        }
      : {}),
    'src/infra/modules/application-core.module.ts': `import { Module } from '@nestjs/common'
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case.js'
import { GetCurrentUserUseCase } from '../../application/users/use-cases/get-current-user.use-case.js'
import { RegisterUserUseCase } from '../../application/users/use-cases/register-user.use-case.js'
import { BcryptPasswordHasher } from '../security/bcrypt-password-hasher.js'
import { JwtTokenService } from '../security/jwt-token.service.js'
${withPostgres ? "import { PrismaUserRepository } from '../repositories/prisma-user.repository.js'" : "import { InMemoryUserRepository } from '../repositories/in-memory-user.repository.js'"}

@Module({
  providers: [
    RegisterUserUseCase,
    LoginUseCase,
    GetCurrentUserUseCase,
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
    {
      provide: 'UserRepositoryContract',
      useClass: ${withPostgres ? 'PrismaUserRepository' : 'InMemoryUserRepository'},
    },
  ],
  exports: [
    RegisterUserUseCase,
    LoginUseCase,
    GetCurrentUserUseCase,
    'PasswordHasherContract',
    'TokenServiceContract',
    'UserRepositoryContract',
  ],
})
export class ApplicationCoreModule {}
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
import { env } from '../../../shared/config/env.js'
import { runtimeConfig } from '../../../shared/config/runtime.js'

@Controller('health')
export class HealthController {
  @Get()
  handle() {
    return {
      status: 'ok',
      framework: runtimeConfig.framework,
      authStrategy: runtimeConfig.authStrategy,
      dataLayer: env.dataLayer,
      orm: '${withPostgres ? 'prisma' : 'memory'}',
      timestamp: new Date().toISOString(),
    }
  }
}
`,
    'src/presentation/http/controllers/auth.controller.ts': `import { Body, Controller, Post } from '@nestjs/common'
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
    'src/presentation/http/modules/health/health-http.module.ts': `import { Module } from '@nestjs/common'
import { HealthController } from '../../controllers/health.controller.js'

@Module({
  controllers: [HealthController],
})
export class HealthHttpModule {}
`,
    'src/presentation/http/modules/auth/auth-http.module.ts': `import { Module } from '@nestjs/common'
import { ApplicationCoreModule } from '../../../../infra/modules/application-core.module.js'
import { AuthController } from '../../controllers/auth.controller.js'

@Module({
  imports: [ApplicationCoreModule],
  controllers: [AuthController],
})
export class AuthHttpModule {}
`,
    'src/presentation/http/modules/users/users-http.module.ts': `import { Module } from '@nestjs/common'
import { ApplicationCoreModule } from '../../../../infra/modules/application-core.module.js'
import { UsersController } from '../../controllers/users.controller.js'
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js'

@Module({
  imports: [ApplicationCoreModule],
  controllers: [UsersController],
  providers: [JwtAuthGuard],
})
export class UsersHttpModule {}
`,
    'README.md': getBackendReadme(
      'Backend NestJS',
      withPostgres ? 'Prisma + PostgreSQL' : 'Repositório em memória',
      answers,
      [
        '```bash',
        'cp .env.example .env',
        'pnpm install',
        ...(withPostgres ? ['pnpm db:generate', 'pnpm db:migrate'] : []),
        'pnpm dev',
        '```',
      ],
    ),
  })
}

export function createFastApi(projectDir: string, answers: Answers) {
  const backendDir = path.join(projectDir, 'apps', 'backend')
  const withPostgres = usesPostgres(answers)

  writeFile(
    path.join(backendDir, 'requirements.txt'),
    `${[
      'fastapi',
      'uvicorn[standard]',
      'pydantic-settings',
      'python-dotenv',
      'email-validator',
      'passlib[bcrypt]',
      'python-jose[cryptography]',
      ...(withPostgres ? ['sqlalchemy', 'psycopg[binary]'] : []),
    ].join('\n')}\n`,
  )

  createFiles(backendDir, {
    '.env.example': getBackendEnvExample(answers),
    'app/__init__.py': '',
    'app/application/__init__.py': '',
    'app/application/auth/__init__.py': '',
    'app/application/auth/use_cases/__init__.py': '',
    'app/application/security/__init__.py': '',
    'app/application/users/__init__.py': '',
    'app/application/users/use_cases/__init__.py': '',
    'app/domain/__init__.py': '',
    'app/domain/users/__init__.py': '',
    'app/domain/users/contracts/__init__.py': '',
    'app/domain/users/entities/__init__.py': '',
    'app/infra/__init__.py': '',
    'app/infra/repositories/__init__.py': '',
    'app/presentation/__init__.py': '',
    'app/presentation/http/__init__.py': '',
    'app/presentation/http/routes/__init__.py': '',
    'app/shared/__init__.py': '',
    'app/shared/config/__init__.py': '',
    'app/shared/config/runtime.py': getRuntimeConfigPy(),
    'app/main.py': `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.presentation.http.errors import register_exception_handlers
from app.presentation.http.routes.auth import router as auth_router
from app.presentation.http.routes.health import router as health_router
from app.presentation.http.routes.users import router as users_router
from app.shared.config.settings import settings
${withPostgres ? "from app.infra.database import Base, engine\nfrom app.infra.models.user_model import UserModel\n" : ''}

app = FastAPI(title=settings.app_name)
register_exception_handlers(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
${withPostgres ? 'Base.metadata.create_all(bind=engine)\n' : ''}
app.include_router(health_router, prefix='/' + settings.global_prefix)
app.include_router(auth_router, prefix='/' + settings.global_prefix)
app.include_router(users_router, prefix='/' + settings.global_prefix)
`,
    'app/shared/config/settings.py': `from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    port: int = 3001
    global_prefix: str = 'api'
    node_env: str = 'development'
    app_name: str = 'Create Stack API'
    cors_origin: str = 'http://localhost:3000,http://localhost:5173'
    data_layer: str = '${withPostgres ? 'postgres' : 'memory'}'
    database_url: str | None = None
    jwt_access_secret: str = 'change-this-secret-with-at-least-32-characters'
    jwt_access_expires_in: str = '1d'

    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origin.split(',') if item.strip()]

    @model_validator(mode='after')
    def validate_dependencies(self):
        if ${withPostgres} and not self.database_url:
            raise ValueError('DATABASE_URL é obrigatória quando PostgreSQL está habilitado.')

        if len(self.jwt_access_secret) < 32:
            raise ValueError('JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres.')

        return self


settings = Settings()
`,
    'app/shared/errors/app_error.py': `class AppError(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str = 'APPLICATION_ERROR', details=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details
`,
    'app/domain/users/entities/user_entity.py': `from dataclasses import dataclass


@dataclass(slots=True)
class UserEntity:
    id: str
    name: str
    email: str
    password_hash: str
    created_at: str
    data_layer: str
`,
    'app/domain/users/contracts/user_repository_contract.py': `from abc import ABC, abstractmethod

from app.domain.users.entities.user_entity import UserEntity


class UserRepositoryContract(ABC):
    @abstractmethod
    def create(self, payload: dict[str, str]) -> UserEntity:
        raise NotImplementedError

    @abstractmethod
    def find_by_email(self, email: str) -> UserEntity | None:
        raise NotImplementedError

    @abstractmethod
    def find_by_id(self, user_id: str) -> UserEntity | None:
        raise NotImplementedError
`,
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
    'app/application/users/schemas.py': `from pydantic import BaseModel, EmailStr, Field


class RegisterUserInput(BaseModel):
    name: str = Field(min_length=3)
    email: EmailStr
    password: str = Field(min_length=8)


class UserOutput(BaseModel):
    id: str
    name: str
    email: EmailStr
    created_at: str
    data_layer: str
`,
    'app/application/auth/schemas.py': `from pydantic import BaseModel, EmailStr, Field

from app.application.users.schemas import UserOutput


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class AuthOutput(BaseModel):
    access_token: str
    user: UserOutput
`,
    'app/application/users/use_cases/register_user_use_case.py': `from app.application.security.password_hasher_contract import PasswordHasherContract
from app.application.users.schemas import RegisterUserInput, UserOutput
from app.domain.users.contracts.user_repository_contract import UserRepositoryContract
from app.shared.errors.app_error import AppError


class RegisterUserUseCase:
    def __init__(
        self,
        user_repository: UserRepositoryContract,
        password_hasher: PasswordHasherContract,
    ):
        self.user_repository = user_repository
        self.password_hasher = password_hasher

    def execute(self, payload: RegisterUserInput) -> UserOutput:
        existing_user = self.user_repository.find_by_email(payload.email)
        if existing_user:
            raise AppError('E-mail já cadastrado.', status_code=409, code='EMAIL_ALREADY_EXISTS')

        password_hash = self.password_hasher.hash(payload.password)
        user = self.user_repository.create(
            {
                'name': payload.name,
                'email': str(payload.email),
                'password_hash': password_hash,
            },
        )

        return UserOutput(
            id=user.id,
            name=user.name,
            email=user.email,
            created_at=user.created_at,
            data_layer=user.data_layer,
        )
`,
    'app/application/auth/use_cases/login_use_case.py': `from app.application.auth.schemas import AuthOutput, LoginInput
from app.application.security.password_hasher_contract import PasswordHasherContract
from app.application.security.token_service_contract import TokenServiceContract
from app.application.users.schemas import UserOutput
from app.domain.users.contracts.user_repository_contract import UserRepositoryContract
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

    def execute(self, payload: LoginInput) -> AuthOutput:
        user = self.user_repository.find_by_email(str(payload.email))
        if not user:
            raise AppError('Credenciais inválidas.', status_code=401, code='INVALID_CREDENTIALS')

        is_password_valid = self.password_hasher.compare(payload.password, user.password_hash)
        if not is_password_valid:
            raise AppError('Credenciais inválidas.', status_code=401, code='INVALID_CREDENTIALS')

        access_token = self.token_service.sign_access_token(
            {
                'sub': user.id,
                'email': user.email,
            },
        )

        return AuthOutput(
            access_token=access_token,
            user=UserOutput(
                id=user.id,
                name=user.name,
                email=user.email,
                created_at=user.created_at,
                data_layer=user.data_layer,
            ),
        )
`,
    'app/application/users/use_cases/get_current_user_use_case.py': `from app.application.users.schemas import UserOutput
from app.domain.users.contracts.user_repository_contract import UserRepositoryContract
from app.shared.errors.app_error import AppError


class GetCurrentUserUseCase:
    def __init__(self, user_repository: UserRepositoryContract):
        self.user_repository = user_repository

    def execute(self, user_id: str) -> UserOutput:
        user = self.user_repository.find_by_id(user_id)
        if not user:
            raise AppError('Usuário não encontrado.', status_code=404, code='USER_NOT_FOUND')

        return UserOutput(
            id=user.id,
            name=user.name,
            email=user.email,
            created_at=user.created_at,
            data_layer=user.data_layer,
        )
`,
    'app/infra/security/bcrypt_password_hasher.py': `from passlib.context import CryptContext

from app.application.security.password_hasher_contract import PasswordHasherContract

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


class BcryptPasswordHasher(PasswordHasherContract):
    def hash(self, value: str) -> str:
        return pwd_context.hash(value)

    def compare(self, value: str, hashed_value: str) -> bool:
        return pwd_context.verify(value, hashed_value)
`,
    'app/infra/security/jwt_token_service.py': `from jose import JWTError, jwt

from app.application.security.token_service_contract import TokenServiceContract
from app.shared.config.settings import settings
from app.shared.errors.app_error import AppError


class JwtTokenService(TokenServiceContract):
    def sign_access_token(self, payload: dict[str, str]) -> str:
        return jwt.encode(payload, settings.jwt_access_secret, algorithm='HS256')

    def verify_access_token(self, token: str) -> dict[str, str]:
        try:
            payload = jwt.decode(token, settings.jwt_access_secret, algorithms=['HS256'])
        except JWTError as error:
            raise AppError('Token inválido ou expirado.', status_code=401, code='INVALID_TOKEN') from error

        if 'sub' not in payload or 'email' not in payload:
            raise AppError('Token inválido.', status_code=401, code='INVALID_TOKEN')

        return {
            'sub': str(payload['sub']),
            'email': str(payload['email']),
        }
`,
    'app/infra/repositories/in_memory_user_repository.py': `from datetime import datetime, timezone
from uuid import uuid4

from app.domain.users.contracts.user_repository_contract import UserRepositoryContract
from app.domain.users.entities.user_entity import UserEntity
from app.shared.config.settings import settings


class InMemoryUserRepository(UserRepositoryContract):
    _users: dict[str, UserEntity] = {}

    def create(self, payload: dict[str, str]) -> UserEntity:
        user = UserEntity(
            id=str(uuid4()),
            name=payload['name'],
            email=payload['email'],
            password_hash=payload['password_hash'],
            created_at=datetime.now(timezone.utc).isoformat(),
            data_layer=settings.data_layer,
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
          'app/infra/database.py': `from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.shared.config.settings import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
`,
          'app/infra/models/__init__.py': '',
          'app/infra/models/user_model.py': `from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.database import Base


class UserModel(Base):
    __tablename__ = 'users'

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    data_layer: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
`,
          'app/infra/repositories/sqlalchemy_user_repository.py': `from app.domain.users.contracts.user_repository_contract import UserRepositoryContract
from app.domain.users.entities.user_entity import UserEntity
from app.infra.database import SessionLocal
from app.infra.models.user_model import UserModel
from app.shared.config.settings import settings


class SqlAlchemyUserRepository(UserRepositoryContract):
    def create(self, payload: dict[str, str]) -> UserEntity:
        with SessionLocal() as session:
            model = UserModel(
                name=payload['name'],
                email=payload['email'],
                password_hash=payload['password_hash'],
                data_layer=settings.data_layer,
            )
            session.add(model)
            session.commit()
            session.refresh(model)

            return UserEntity(
                id=model.id,
                name=model.name,
                email=model.email,
                password_hash=model.password_hash,
                created_at=model.created_at.isoformat(),
                data_layer=model.data_layer,
            )

    def find_by_email(self, email: str) -> UserEntity | None:
        with SessionLocal() as session:
            model = session.query(UserModel).filter(UserModel.email == email).one_or_none()
            if not model:
                return None
            return UserEntity(
                id=model.id,
                name=model.name,
                email=model.email,
                password_hash=model.password_hash,
                created_at=model.created_at.isoformat(),
                data_layer=model.data_layer,
            )

    def find_by_id(self, user_id: str) -> UserEntity | None:
        with SessionLocal() as session:
            model = session.query(UserModel).filter(UserModel.id == user_id).one_or_none()
            if not model:
                return None
            return UserEntity(
                id=model.id,
                name=model.name,
                email=model.email,
                password_hash=model.password_hash,
                created_at=model.created_at.isoformat(),
                data_layer=model.data_layer,
            )
`,
        }
      : {}),
    'app/infra/dependencies.py': `from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.application.auth.use_cases.login_use_case import LoginUseCase
from app.application.users.use_cases.get_current_user_use_case import GetCurrentUserUseCase
from app.application.users.use_cases.register_user_use_case import RegisterUserUseCase
from app.infra.security.bcrypt_password_hasher import BcryptPasswordHasher
import app.infra.security.jwt_token_service as jwt_token_service_module
${withPostgres ? "from app.infra.repositories.sqlalchemy_user_repository import SqlAlchemyUserRepository" : "from app.infra.repositories.in_memory_user_repository import InMemoryUserRepository"}
from app.shared.errors.app_error import AppError

security = HTTPBearer(auto_error=False)
user_repository = ${withPostgres ? 'SqlAlchemyUserRepository()' : 'InMemoryUserRepository()'}
password_hasher = BcryptPasswordHasher()
token_service = jwt_token_service_module.JwtTokenService()


def get_register_user_use_case() -> RegisterUserUseCase:
    return RegisterUserUseCase(user_repository, password_hasher)


def get_login_use_case() -> LoginUseCase:
    return LoginUseCase(user_repository, password_hasher, token_service)


def get_current_user_use_case() -> GetCurrentUserUseCase:
    return GetCurrentUserUseCase(user_repository)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if not credentials:
        raise AppError('Token ausente.', status_code=401, code='MISSING_TOKEN')

    payload = token_service.verify_access_token(credentials.credentials)
    return payload['sub']
`,
    'app/presentation/http/models.py': `from pydantic import BaseModel, EmailStr, Field


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
    data_layer: str


class AuthResponse(BaseModel):
    access_token: str
    user: UserResponse


class HealthResponse(BaseModel):
    status: str
    framework: str
    auth_strategy: str
    data_layer: str
    orm: str
    timestamp: str
`,
    'app/presentation/http/errors.py': `from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.shared.errors.app_error import AppError


def register_exception_handlers(app: FastAPI):
    @app.exception_handler(AppError)
    async def handle_application_error(_request: Request, error: AppError):
        return JSONResponse(
            status_code=error.status_code,
            content={
                'message': error.message,
                'code': error.code,
                'details': error.details,
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, error: Exception):
        return JSONResponse(
            status_code=500,
            content={
                'message': 'Erro interno não tratado.',
                'code': 'INTERNAL_SERVER_ERROR',
                'details': str(error),
            },
        )
`,
    'app/presentation/http/routes/health.py': `from datetime import datetime, timezone

from fastapi import APIRouter

from app.presentation.http.models import HealthResponse
from app.shared.config.runtime import RUNTIME_CONFIG
from app.shared.config.settings import settings

router = APIRouter(prefix='/health', tags=['health'])


@router.get('', response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(
        status='ok',
        framework=RUNTIME_CONFIG['framework'],
        auth_strategy=RUNTIME_CONFIG['auth_strategy'],
        data_layer=settings.data_layer,
        orm='${withPostgres ? 'sqlalchemy' : 'memory'}',
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
`,
    'app/presentation/http/routes/auth.py': `from fastapi import APIRouter, Depends, status

from app.application.auth.use_cases.login_use_case import LoginUseCase
from app.application.users.use_cases.register_user_use_case import RegisterUserUseCase
from app.infra.dependencies import get_login_use_case, get_register_user_use_case
from app.presentation.http.models import AuthResponse, LoginBody, RegisterUserBody, UserResponse

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/register', response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterUserBody,
    use_case: RegisterUserUseCase = Depends(get_register_user_use_case),
) -> UserResponse:
    return use_case.execute(body)


@router.post('/login', response_model=AuthResponse)
def login(
    body: LoginBody,
    use_case: LoginUseCase = Depends(get_login_use_case),
) -> AuthResponse:
    return use_case.execute(body)
`,
    'app/presentation/http/routes/users.py': `from fastapi import APIRouter, Depends

from app.application.users.use_cases.get_current_user_use_case import GetCurrentUserUseCase
from app.infra.dependencies import get_current_user_id, get_current_user_use_case
from app.presentation.http.models import UserResponse

router = APIRouter(prefix='/users', tags=['users'])


@router.get('/me', response_model=UserResponse)
def get_me(
    user_id: str = Depends(get_current_user_id),
    use_case: GetCurrentUserUseCase = Depends(get_current_user_use_case),
) -> UserResponse:
    return use_case.execute(user_id)
`,
    'README.md': getBackendReadme(
      'Backend FastAPI',
      withPostgres ? 'SQLAlchemy + PostgreSQL' : 'Repositório em memória',
      answers,
      [
        '```bash',
        'cp .env.example .env',
        'python3 -m venv .venv',
        'source .venv/bin/activate',
        'pip install -r requirements.txt',
        'uvicorn app.main:app --reload --port 3001',
        '```',
      ],
    ),
  })
}
