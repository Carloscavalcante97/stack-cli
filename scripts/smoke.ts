// Gera cada stack num diretório temporário e prova que o projeto gerado funciona:
// build, testes, lint e o fluxo real de autenticação contra o servidor rodando.
// JWT: register → login → /users/me. Firebase: token do emulador de Auth → /users/me.
// Variantes PostgreSQL sobem o banco pelo docker-compose gerado e rodam a migration.
// Cada Dockerfile gerado é buildado e o container precisa responder no health.
// Uso: pnpm smoke [nome...]  (requer pnpm, uv, Docker e firebase-tools com Java)
import assert from 'node:assert/strict'
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { generateProject } from '../src/generate.js'
import type { Answers } from '../src/types.js'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'create-stack-smoke-'))
const emulatorHost = '127.0.0.1:9099'
const firebaseProjectId = 'demo-smoke'
const headers = { 'content-type': 'application/json' }

const sh = (command: string, cwd: string) => execSync(command, { cwd, stdio: 'inherit' })
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function startDetached(command: string, cwd: string, env: Record<string, string> = {}) {
  const child = spawn(command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    detached: true,
    env: { ...process.env, ...env },
  })
  return () => process.kill(-child.pid!, 'SIGTERM')
}

async function waitFor(url: string) {
  for (let attempt = 0; attempt <= 120; attempt++) {
    if (
      await fetch(url).then(
        (r) => r.ok,
        () => false,
      )
    )
      return
    await sleep(500)
  }
  throw new Error(`não respondeu: ${url}`)
}

async function checkJwtFlow(api: string) {
  const post = (route: string, body: unknown) =>
    fetch(api + route, { method: 'POST', headers, body: JSON.stringify(body) })
  const credentials = { email: 'smoke@example.com', password: '12345678' }

  assert.equal((await post('/auth/register', { name: 'Smoke Test', ...credentials })).status, 201)
  assert.ok([400, 422].includes((await post('/auth/register', { email: 'x' })).status))

  const login = await post('/auth/login', credentials)
  assert.equal(login.status, 200)
  const { accessToken, access_token } = await login.json()

  const me = await fetch(api + '/users/me', {
    headers: { authorization: `Bearer ${accessToken ?? access_token}` },
  })
  assert.equal(me.status, 200)
  assert.equal((await me.json()).email, credentials.email)
  assert.equal((await fetch(api + '/users/me')).status, 401)
}

async function checkFirebaseFlow(api: string, email: string) {
  // O emulador emite um ID token de verdade (sem assinatura, como o SDK espera no modo emulador)
  const signUp = await fetch(
    `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password: '12345678', returnSecureToken: true }),
    },
  )
  const { idToken } = await signUp.json()
  assert.ok(idToken, 'emulador não devolveu idToken')

  const me = (token?: string) =>
    fetch(api + '/users/me', { headers: token ? { authorization: `Bearer ${token}` } : {} })

  const first = await me(idToken)
  assert.equal(first.status, 200)
  const user = await first.json()
  assert.equal(user.email, email)

  const second = await me(idToken)
  assert.equal(second.status, 200)
  assert.equal((await second.json()).id, user.id, 'segundo acesso deveria reaproveitar o usuário')

  assert.equal((await me()).status, 401)
  assert.equal((await me('token-invalido')).status, 401)
  const passwordLogin = await fetch(api + '/auth/login', { method: 'POST', headers, body: '{}' })
  assert.equal(passwordLogin.status, 404, 'login por senha não deveria existir com Firebase')
}

// Sobe a imagem do app e espera o health; o container alcança o Postgres do compose pelo host
async function checkImage(
  projectDir: string,
  app: 'backend' | 'frontend',
  ports: { host: number; container: number },
  healthPath: string,
  env: Record<string, string> = {},
) {
  const tag = `create-stack-smoke-${path.basename(projectDir)}-${app}`
  sh(`docker build -q -t ${tag} -f apps/${app}/Dockerfile .`, projectDir)
  const envFlags = Object.entries(env)
    .map(([key, value]) => `-e ${key}=${value}`)
    .join(' ')
  sh(
    `docker run -d --name ${tag} --add-host=host.docker.internal:host-gateway -p ${ports.host}:${ports.container} ${envFlags} ${tag}`,
    projectDir,
  )
  try {
    await waitFor(`http://localhost:${ports.host}${healthPath}`)
  } catch (error) {
    sh(`docker logs ${tag}`, projectDir)
    throw error
  } finally {
    sh(`docker rm -f ${tag} && docker rmi ${tag}`, projectDir)
  }
}

async function checkServer(
  command: string,
  cwd: string,
  port: number,
  healthPath: string,
  answers: Answers,
) {
  const withFirebase = answers.auth === 'firebase'
  const stop = startDetached(command, cwd, {
    PORT: String(port),
    ...(withFirebase
      ? { FIREBASE_PROJECT_ID: firebaseProjectId, FIREBASE_AUTH_EMULATOR_HOST: emulatorHost }
      : {}),
  })
  const api = `http://localhost:${port}/api`

  try {
    await waitFor(api + healthPath)
    if (withFirebase) await checkFirebaseFlow(api, `${answers.projectName}@example.com`)
    else await checkJwtFlow(api)
  } finally {
    stop()
  }
}

const allCases: (Partial<Answers> & { projectName: string })[] = [
  { projectName: 'nest', backend: 'nest', frontend: 'next', useHusky: true },
  { projectName: 'express', backend: 'express', frontend: 'vite' },
  { projectName: 'fastapi', backend: 'fastapi' },
  { projectName: 'nest-pg', backend: 'nest', dataLayer: 'postgres' },
  { projectName: 'express-pg', backend: 'express', dataLayer: 'postgres' },
  { projectName: 'fastapi-pg', backend: 'fastapi', dataLayer: 'postgres' },
  { projectName: 'nest-fb', backend: 'nest', frontend: 'next', auth: 'firebase' },
  { projectName: 'express-fb', backend: 'express', frontend: 'vite', auth: 'firebase' },
  { projectName: 'fastapi-fb', backend: 'fastapi', auth: 'firebase' },
  { projectName: 'nest-fb-pg', backend: 'nest', dataLayer: 'postgres', auth: 'firebase' },
  { projectName: 'express-fb-pg', backend: 'express', dataLayer: 'postgres', auth: 'firebase' },
  { projectName: 'fastapi-fb-pg', backend: 'fastapi', dataLayer: 'postgres', auth: 'firebase' },
]

const only = process.argv.slice(2)
const cases = allCases.filter((c) => only.length === 0 || only.includes(c.projectName))

fs.writeFileSync(
  path.join(root, 'firebase.json'),
  JSON.stringify({ emulators: { auth: { port: 9099 } } }),
)
const stopEmulator = startDetached(
  `firebase emulators:start --only auth --project ${firebaseProjectId}`,
  root,
)

try {
  await waitFor(`http://${emulatorHost}/`)

  let port = 4100
  for (const partial of cases) {
    const answers: Answers = {
      backend: 'none',
      frontend: 'none',
      dataLayer: 'none',
      auth: 'jwt',
      useHusky: false,
      ...partial,
      provisionPostgres: partial.dataLayer === 'postgres',
    }
    const withPostgres = answers.provisionPostgres
    const projectDir = path.join(root, answers.projectName)
    const backendDir = path.join(projectDir, 'apps', 'backend')
    const compose = 'docker compose -f infra/docker/docker-compose.yml'
    console.log(`\n=== ${answers.projectName} → ${projectDir}`)

    generateProject(projectDir, answers)
    if (withPostgres) sh(`${compose} up -d --wait`, projectDir)

    try {
      if (answers.backend !== 'fastapi' || answers.frontend !== 'none') sh('pnpm lint', projectDir)

      if (answers.useHusky) {
        const hooksPath = execSync('git config core.hooksPath', { cwd: projectDir }).toString()
        assert.equal(hooksPath.trim(), '.husky/_')
      }

      if (answers.backend === 'nest' || answers.backend === 'express') {
        sh('pnpm --filter @apps/backend build', projectDir)
        sh('pnpm --filter @apps/backend test', projectDir)
        // --name evita o prompt interativo do prisma migrate dev
        if (withPostgres) sh('pnpm --filter @apps/backend db:migrate --name init', projectDir)
        await checkServer('pnpm dev', backendDir, port++, '/health', answers)
      }

      if (answers.backend === 'fastapi') {
        sh(
          'uv venv -q -p 3.12 .venv && uv pip install -q -p .venv -r requirements-dev.txt',
          backendDir,
        )
        sh('.venv/bin/ruff check .', backendDir)
        sh('.venv/bin/pytest -q', backendDir)
        // Com PostgreSQL, as tabelas nascem no startup (create_all no lifespan) e o
        // /health/ready só responde 200 se o banco responder
        const uvicorn = `.venv/bin/uvicorn app.main:app --port ${port}`
        const health = withPostgres ? '/health/ready' : '/health/live'
        await checkServer(uvicorn, backendDir, port++, health, answers)
      }

      // O container não lê o .env: recebe só o que a produção precisaria
      await checkImage(
        projectDir,
        'backend',
        { host: port++, container: 3001 },
        answers.backend === 'fastapi' ? `/api/health/${withPostgres ? 'ready' : 'live'}` : '/api/health',
        {
          ...(answers.auth === 'firebase'
            ? {
                FIREBASE_PROJECT_ID: firebaseProjectId,
                // O SDK Python exige credencial fora do emulador; o health não chega a usá-lo
                FIREBASE_AUTH_EMULATOR_HOST: 'host.docker.internal:9099',
              }
            : { JWT_ACCESS_SECRET: 'smoke-secret-with-at-least-32-characters' }),
          ...(withPostgres
            ? { DATABASE_URL: 'postgresql://postgres:postgres@host.docker.internal:5432/app_db' }
            : {}),
        },
      )

      if (answers.frontend !== 'none') {
        // Com Firebase, builda com config preenchida: o SDK inicializa durante o prerender
        const prefix = answers.frontend === 'next' ? 'NEXT_PUBLIC_' : 'VITE_'
        const firebaseEnv =
          answers.auth === 'firebase'
            ? `${prefix}FIREBASE_API_KEY=fake-api-key ${prefix}FIREBASE_PROJECT_ID=${firebaseProjectId} `
            : ''
        sh(`${firebaseEnv}pnpm --filter @apps/frontend build`, projectDir)
        await checkImage(
          projectDir,
          'frontend',
          { host: port++, container: answers.frontend === 'next' ? 3000 : 80 },
          '/',
        )
      }
    } finally {
      if (withPostgres) sh(`${compose} down -v`, projectDir)
    }
  }
} finally {
  stopEmulator()
}

console.log(`\nSmoke OK (${cases.length} stacks). Projetos em ${root}`)
