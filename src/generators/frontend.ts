import path from 'node:path'
import { writeFile } from '../utils/fs.js'
import type { Answers } from '../types.js'
import { usesPostgres } from '../types.js'


function getSharedStyles(withAuth: boolean) {
  return `:root {
  color-scheme: light;
  --bg: #f7f2e8;
  --surface: rgba(255, 252, 245, 0.84);
  --surface-strong: rgba(255, 248, 236, 0.96);
  --text: #1f1a17;
  --muted: #65584f;
  --primary: #0f766e;
  --primary-strong: #115e59;
  --accent: #d97706;
  --border: rgba(31, 26, 23, 0.12);
  --shadow: 0 28px 70px rgba(77, 56, 27, 0.16);
  font-synthesis-weight: none;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(217, 119, 6, 0.18), transparent 32%),
    radial-gradient(circle at top right, rgba(15, 118, 110, 0.16), transparent 28%),
    linear-gradient(180deg, #fffdf8 0%, var(--bg) 100%);
  color: var(--text);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

body {
  min-height: 100vh;
}

.page-shell {
  min-height: 100vh;
  padding: 32px 20px 48px;
}

.hero {
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 24px;
  align-items: start;
}

.panel,
.side-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}

.panel {
  padding: 28px;
}

.side-card {
  padding: 24px;
  display: grid;
  gap: 16px;
}

.eyebrow {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(15, 118, 110, 0.08);
  color: var(--primary-strong);
  letter-spacing: 0.08em;
  font-size: 12px;
  text-transform: uppercase;
}

.hero h1 {
  margin: 18px 0 12px;
  font-size: clamp(2.4rem, 6vw, 4.8rem);
  line-height: 0.94;
}

.side-card h2 {
  margin: 0;
  font-size: 1.6rem;
}

.hero p,
.side-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 28px;
}

.metric {
  padding: 18px;
  border-radius: 20px;
  background: var(--surface-strong);
  border: 1px solid rgba(31, 26, 23, 0.08);
}

.metric strong {
  display: block;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  color: var(--primary-strong);
}

.note-list {
  margin: 22px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}

.note-list li {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(31, 26, 23, 0.08);
}

.action-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.primary-button,
.secondary-button {
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  cursor: pointer;
  font: inherit;
}

.primary-button {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: white;
}

.secondary-button {
  background: rgba(31, 26, 23, 0.08);
  color: var(--text);
}

${withAuth ? `.auth-panel {
  display: grid;
  gap: 12px;
}

.auth-panel input {
  font: inherit;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface-strong);
}

.auth-panel pre {
  margin: 0;
  padding: 12px;
  border-radius: 14px;
  background: rgba(31, 26, 23, 0.06);
  overflow-x: auto;
  font-size: 13px;
}

.auth-error {
  color: #b91c1c;
}

` : ''}@media (max-width: 980px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .grid {
    grid-template-columns: 1fr;
  }
}
`
}

function getFeatureItems(answers: Answers) {
  return [
    'Frontend com env centralizado para conversar com o backend desde o primeiro commit.',
    usesPostgres(answers)
      ? 'Estrutura pronta para consumir APIs com persistência relacional em PostgreSQL.'
      : 'Estrutura desacoplada da camada de persistência para evoluir sem retrabalho.',
    'Base visual inicial pensada para times que querem sair do scaffold e entrar no produto rápido.',
  ]
}

function getNextPage(answers: Answers) {
  return `${answers.auth === 'firebase' ? "import { AuthPanel } from '../src/components/auth-panel'\n" : ''}import { publicEnv } from '../src/config/env'

const features = ${JSON.stringify(getFeatureItems(answers), null, 2)}

const metrics = [
  { label: 'Persistência', value: '${answers.dataLayer}' },
  { label: 'Backend URL', value: publicEnv.apiUrl },
  { label: 'Frontend', value: 'Next.js' },
]

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero">
        <article className="panel">
          <span className="eyebrow">Product-ready frontend</span>
          <h1>Uma base visual pronta para produto e integração.</h1>
          <p>
            Este scaffold organiza interface, ambiente e comunicação com backend para que a equipe
            avance mais rápido sem precisar reestruturar o projeto logo no início.
          </p>

          <div className="grid">
            {metrics.map((item) => (
              <div className="metric" key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </div>
            ))}
          </div>

          <ul className="note-list">
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

${answers.auth === 'firebase' ? `        <section className="side-card">
          <h2>Entrar</h2>
          <AuthPanel />
        </section>` : `        <section className="side-card">
          <h2>Próxima camada da UI</h2>
          <p>
            O frontend já nasce com shell, estilo base e variáveis de ambiente para vocês plugarem
            autenticação, design system e módulos de negócio sem trocar a estrutura principal.
          </p>
          <div className="action-row">
            <button className="primary-button" type="button">Criar fluxo principal</button>
            <button className="secondary-button" type="button">Conectar API</button>
          </div>
        </section>`}
      </section>
    </main>
  )
}
`
}

type FrontendKind = 'next' | 'vite'

const firebaseEnvKeys = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID']

function envPrefix(kind: FrontendKind) {
  return kind === 'next' ? 'NEXT_PUBLIC_' : 'VITE_'
}

function getEnvConfig(kind: FrontendKind, withFirebase: boolean) {
  // Next só injeta NEXT_PUBLIC_* com acesso literal (process.env.NOME), sem índice dinâmico
  const read = (name: string) =>
    kind === 'next' ? `process.env.NEXT_PUBLIC_${name}` : `import.meta.env.VITE_${name}`
  const firebase = withFirebase
    ? `
  firebase: {
    apiKey: ${read('FIREBASE_API_KEY')},
    authDomain: ${read('FIREBASE_AUTH_DOMAIN')},
    projectId: ${read('FIREBASE_PROJECT_ID')},
    appId: ${read('FIREBASE_APP_ID')},
  },
  firebaseAuthEmulatorHost: ${read('FIREBASE_AUTH_EMULATOR_HOST')},`
    : ''
  return `export const publicEnv = {
  apiUrl: ${read('API_URL')} ?? 'http://localhost:3001/api',${firebase}
} as const
`
}

function getEnvExample(kind: FrontendKind, withFirebase: boolean) {
  const prefix = envPrefix(kind)
  return `${[
    `${prefix}API_URL=http://localhost:3001/api`,
    ...(withFirebase
      ? [
          '# Console do Firebase > Configurações do projeto > Seus apps > App da Web',
          ...firebaseEnvKeys.map((key) => `${prefix}FIREBASE_${key}=`),
          '# Dev local sem projeto real: firebase emulators:start --only auth --project demo-app',
          `# ${prefix}FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`,
        ]
      : []),
  ].join('\n')}\n`
}

// O contexto do build é a raiz do monorepo: o pnpm-lock.yaml fica lá
function getDockerfile(kind: FrontendKind, withFirebase: boolean) {
  const buildArgs = ['API_URL', ...(withFirebase ? firebaseEnvKeys.map((key) => `FIREBASE_${key}`) : [])]
    .map((name) => `ARG ${envPrefix(kind)}${name}`)
    .join('\n')
  const build = `# Build a partir da raiz: docker build -f apps/frontend/Dockerfile .
FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Variáveis públicas entram no bundle durante o build: passe com --build-arg
${buildArgs}
`

  if (kind === 'vite') {
    return `${build}RUN pnpm --filter @apps/frontend build

FROM nginx:1.30-alpine
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
`
  }

  return `${build}ENV NEXT_OUTPUT=standalone
RUN mkdir -p apps/frontend/public && pnpm --filter @apps/frontend build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Saída standalone do Next: só os arquivos que o servidor usa
COPY --from=build /repo/apps/frontend/.next/standalone ./
COPY --from=build /repo/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /repo/apps/frontend/public ./apps/frontend/public
USER node
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
`
}

function getFirebaseReadme(kind: FrontendKind) {
  const envFile = kind === 'next' ? '.env.local' : '.env'
  return `
## Firebase Auth
1. Copie \`${envFile}.example\` para \`${envFile}\` e preencha \`${envPrefix(kind)}FIREBASE_*\` com a config do App da Web.
2. No Console, em Authentication > Sign-in method, habilite E-mail/senha e Google.
3. \`src/lib/firebase.ts\` tem as ações (\`login\`, \`register\`, \`loginWithGoogle\`, \`logout\`), e \`useAuth()\` (em \`src/components/auth-provider.tsx\`) expõe o usuário logado.
4. \`apiFetch\` (\`src/lib/api.ts\`) envia o ID token em toda chamada à API.
5. Para desenvolver sem projeto real, rode o emulador na raiz (\`firebase emulators:start --only auth --project demo-app\`), use \`demo-app\` como project ID, qualquer API key e \`${envPrefix(kind)}FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099\`. O login com Google abre a tela de contas fake do emulador.
`
}

function getFirebaseFiles(kind: FrontendKind, answers: Answers): Record<string, string> {
  const useClient = kind === 'next' ? "'use client'\n\n" : ''
  const envFile = kind === 'next' ? '.env.local' : '.env'
  const hasBackend = answers.backend !== 'none'

  return {
    'src/lib/firebase.ts': `import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth'
import { publicEnv } from '../config/env'

// Sem config o app continua de pé e o painel de login explica o que falta
export const auth: Auth | null = publicEnv.firebase.apiKey
  ? getAuth(initializeApp(publicEnv.firebase))
  : null

// Dev local com o emulador; o if evita reconectar quando o HMR reexecuta o módulo
if (auth && publicEnv.firebaseAuthEmulatorHost && !auth.emulatorConfig) {
  connectAuthEmulator(auth, \`http://\${publicEnv.firebaseAuthEmulatorHost}\`)
}

function requireAuth() {
  if (!auth) throw new Error('Firebase não configurado.')
  return auth
}

export const login = (email: string, password: string) =>
  signInWithEmailAndPassword(requireAuth(), email, password)

export const register = (email: string, password: string) =>
  createUserWithEmailAndPassword(requireAuth(), email, password)

export const loginWithGoogle = () => signInWithPopup(requireAuth(), new GoogleAuthProvider())

export const logout = () => signOut(requireAuth())
`,
    ...(hasBackend
      ? {
          'src/lib/api.ts': `import { publicEnv } from '../config/env'
import { auth } from './firebase'

// Toda chamada à API leva o ID token do usuário logado
export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const token = await auth?.currentUser?.getIdToken()
  if (token) headers.set('Authorization', \`Bearer \${token}\`)
  return fetch(publicEnv.apiUrl + path, { ...init, headers })
}
`,
        }
      : {}),
    'src/components/auth-provider.tsx': `${useClient}import { onAuthStateChanged, type User } from 'firebase/auth'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth } from '../lib/firebase'

type AuthState = { user: User | null; loading: boolean }

const AuthContext = createContext<AuthState>({ user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: auth !== null })

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (user) => setState({ user, loading: false }))
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
`,
    'src/components/auth-panel.tsx': `${useClient}import { useState, type FormEvent } from 'react'
${hasBackend ? "import { apiFetch } from '../lib/api'\n" : ''}import { auth, login, loginWithGoogle, logout, register } from '../lib/firebase'
import { useAuth } from './auth-provider'

export function AuthPanel() {
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
${hasBackend ? '  const [profile, setProfile] = useState<unknown>(null)\n' : ''}
  if (!auth) {
    return <p>Login desativado: preencha ${envPrefix(kind)}FIREBASE_* em ${envFile}.</p>
  }

  if (loading) return <p>Carregando sessão...</p>

  const run = (action: () => Promise<unknown>) => {
    setError(null)
    action().catch((err: Error) => setError(err.message))
  }

  if (user) {
    return (
      <div className="auth-panel">
        <p>
          Conectado como <strong>{user.email}</strong>
        </p>
        <div className="action-row">
${hasBackend ? `          <button
            className="primary-button"
            type="button"
            onClick={() => run(async () => setProfile(await (await apiFetch('/users/me')).json()))}
          >
            Chamar /users/me
          </button>
` : ''}          <button className="secondary-button" type="button" onClick={() => run(logout)}>
            Sair
          </button>
        </div>
${hasBackend ? '        {profile ? <pre>{JSON.stringify(profile, null, 2)}</pre> : null}\n' : ''}        {error && <p className="auth-error">{error}</p>}
      </div>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    run(() => login(email, password))
  }

  return (
    <form className="auth-panel" onSubmit={submit}>
      <input
        type="email"
        aria-label="E-mail"
        placeholder="E-mail"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <input
        type="password"
        aria-label="Senha"
        placeholder="Senha"
        autoComplete="current-password"
        required
        minLength={6}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <div className="action-row">
        <button className="primary-button" type="submit">
          Entrar
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => run(() => register(email, password))}
        >
          Criar conta
        </button>
        <button className="secondary-button" type="button" onClick={() => run(loginWithGoogle)}>
          Google
        </button>
      </div>
      {error && <p className="auth-error">{error}</p>}
    </form>
  )
}
`,
  }
}

export function createNext(projectDir: string, answers: Answers) {
  const frontendDir = path.join(projectDir, 'apps', 'frontend')
  const withFirebase = answers.auth === 'firebase'

  writeFile(
    path.join(frontendDir, 'package.json'),
    JSON.stringify(
      {
        name: '@apps/frontend',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          ...(withFirebase ? { firebase: '^12.19.0' } : {}),
          next: '^15.1.6',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
        },
        devDependencies: {
          '@types/node': '^22.10.2',
          '@types/react': '^19.0.2',
          '@types/react-dom': '^19.0.2',
          typescript: '^5.7.2',
        },
      },
      null,
      2,
    ),
  )

  writeFile(path.join(frontendDir, '.env.local.example'), getEnvExample('next', withFirebase))
  writeFile(path.join(frontendDir, 'Dockerfile'), getDockerfile('next', withFirebase))
  writeFile(
    path.join(frontendDir, 'tsconfig.json'),
    `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
`,
  )
  writeFile(
    path.join(frontendDir, 'next.config.ts'),
    `import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Só no Dockerfile: com standalone, o \`next start\` local passa a emitir aviso.
  // O rastreio parte da raiz do monorepo, onde o pnpm guarda as dependências.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // O lint roda no \`pnpm lint\` da raiz
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
`,
  )
  writeFile(
    path.join(frontendDir, 'next-env.d.ts'),
    `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`,
  )
  writeFile(
    path.join(frontendDir, 'src', 'config', 'env.ts'),
    getEnvConfig('next', withFirebase),
  )
  if (withFirebase) {
    for (const [file, content] of Object.entries(getFirebaseFiles('next', answers))) {
      writeFile(path.join(frontendDir, file), content)
    }
  }
  writeFile(
    path.join(frontendDir, 'app', 'layout.tsx'),
    `import type { Metadata } from 'next'
${withFirebase ? "import { AuthProvider } from '../src/components/auth-provider'\n" : ''}import './globals.css'

export const metadata: Metadata = {
  title: '${answers.projectName}',
  description: 'Frontend genérico pronto para acelerar o início de produto.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>${withFirebase ? '\n        <AuthProvider>{children}</AuthProvider>\n      ' : '{children}'}</body>
    </html>
  )
}
`,
  )
  writeFile(path.join(frontendDir, 'app', 'page.tsx'), getNextPage(answers))
  writeFile(path.join(frontendDir, 'app', 'globals.css'), getSharedStyles(answers.auth === 'firebase'))
  writeFile(
    path.join(frontendDir, 'README.md'),
    `# Frontend Next.js

## Rodar

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

A API padrão é \`http://localhost:3001/api\`. Para mudar, copie \`.env.local.example\` para \`.env.local\`.

## Destaques
- Integração com backend por NEXT_PUBLIC_API_URL
- Shell inicial pronto para produto
${withFirebase ? '- Login com Firebase Auth (e-mail/senha e Google)' : '- Estrutura genérica para conectar qualquer estratégia de auth depois'}
${withFirebase ? getFirebaseReadme('next') : ''}`,
  )
}

export function createVite(projectDir: string, answers: Answers) {
  const frontendDir = path.join(projectDir, 'apps', 'frontend')
  const withFirebase = answers.auth === 'firebase'

  writeFile(
    path.join(frontendDir, 'package.json'),
    JSON.stringify(
      {
        name: '@apps/frontend',
        private: true,
        scripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          preview: 'vite preview',
        },
        dependencies: {
          ...(withFirebase ? { firebase: '^12.19.0' } : {}),
          react: '^19.0.0',
          'react-dom': '^19.0.0',
        },
        devDependencies: {
          '@types/react': '^19.0.2',
          '@types/react-dom': '^19.0.2',
          '@vitejs/plugin-react': '^4.3.4',
          typescript: '^5.7.2',
          vite: '^6.0.5',
        },
      },
      null,
      2,
    ),
  )

  writeFile(path.join(frontendDir, '.env.example'), getEnvExample('vite', withFirebase))
  writeFile(path.join(frontendDir, 'Dockerfile'), getDockerfile('vite', withFirebase))
  writeFile(
    path.join(frontendDir, 'tsconfig.json'),
    `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
`,
  )
  writeFile(
    path.join(frontendDir, 'vite.config.ts'),
    `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
  )
  writeFile(
    path.join(frontendDir, 'index.html'),
    `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${answers.projectName}</title>
    <script type="module" src="/src/main.tsx"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`,
  )
  writeFile(
    path.join(frontendDir, 'src', 'config', 'env.ts'),
    getEnvConfig('vite', withFirebase),
  )
  if (withFirebase) {
    for (const [file, content] of Object.entries(getFirebaseFiles('vite', answers))) {
      writeFile(path.join(frontendDir, file), content)
    }
  }
  writeFile(
    path.join(frontendDir, 'src', 'main.tsx'),
    `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
${withFirebase ? "import { AuthProvider } from './components/auth-provider'\n" : ''}import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    ${withFirebase ? '<AuthProvider>\n      <App />\n    </AuthProvider>' : '<App />'}
  </React.StrictMode>,
)
`,
  )
  writeFile(
    path.join(frontendDir, 'src', 'vite-env.d.ts'),
    `/// <reference types="vite/client" />
`,
  )
  writeFile(
    path.join(frontendDir, 'src', 'App.tsx'),
    `${answers.auth === 'firebase' ? "import { AuthPanel } from './components/auth-panel'\n" : ''}import { publicEnv } from './config/env'

const metrics = [
  { label: 'Persistência', value: '${answers.dataLayer}' },
  { label: 'Backend URL', value: publicEnv.apiUrl },
  { label: 'Frontend', value: 'Vite + React' },
]

const notes = ${JSON.stringify(getFeatureItems(answers), null, 2)}

function App() {
  return (
    <main className="page-shell">
      <section className="hero">
        <article className="panel">
          <span className="eyebrow">Product-ready frontend</span>
          <h1>Uma base visual pronta para produto e integração.</h1>
          <p>
            Esta aplicação já nasce organizada para conversar com backend, crescer com o time
            e receber fluxos reais de produto sem reestruturação precoce.
          </p>

          <div className="grid">
            {metrics.map((item) => (
              <div className="metric" key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </div>
            ))}
          </div>

          <ul className="note-list">
            {notes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

${answers.auth === 'firebase' ? `        <section className="side-card">
          <h2>Entrar</h2>
          <AuthPanel />
        </section>` : `        <section className="side-card">
          <h2>Próxima camada da UI</h2>
          <p>
            O scaffold deixa a base preparada para vocês plugarem autenticação, estado global,
            design system e regras de negócio no ritmo do produto.
          </p>
          <div className="action-row">
            <button className="primary-button" type="button">Criar fluxo principal</button>
            <button className="secondary-button" type="button">Conectar API</button>
          </div>
        </section>`}
      </section>
    </main>
  )
}

export default App
`,
  )
  writeFile(path.join(frontendDir, 'src', 'index.css'), getSharedStyles(answers.auth === 'firebase'))
  writeFile(
    path.join(frontendDir, 'README.md'),
    `# Frontend Vite

## Rodar

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

A API padrão é \`http://localhost:3001/api\`. Para mudar, copie \`.env.example\` para \`.env\`.

## Destaques
- Integração com backend por VITE_API_URL
- Shell inicial pronto para produto
${withFirebase ? '- Login com Firebase Auth (e-mail/senha e Google)' : '- Estrutura genérica para conectar qualquer estratégia de auth depois'}
${withFirebase ? getFirebaseReadme('vite') : ''}`,
  )
}
