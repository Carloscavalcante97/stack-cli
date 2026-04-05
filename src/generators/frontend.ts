import path from 'node:path'
import { writeFile } from '../utils/fs.js'
import type { Answers } from '../types.js'
import { usesPostgres } from '../types.js'

function getNextEnvExample(answers: Answers) {
  return `NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_DATA_LAYER=${answers.dataLayer}
`
}

function getViteEnvExample(answers: Answers) {
  return `VITE_API_URL=http://localhost:3001/api
VITE_DATA_LAYER=${answers.dataLayer}
`
}

function getSharedStyles() {
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
  font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
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

.hero h1,
.side-card h2 {
  font-family: 'Space Grotesk', 'IBM Plex Sans', sans-serif;
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

@media (max-width: 980px) {
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
  return `const features = ${JSON.stringify(getFeatureItems(answers), null, 2)}

const metrics = [
  { label: 'Persistência', value: '${answers.dataLayer}' },
  { label: 'Backend URL', value: 'NEXT_PUBLIC_API_URL' },
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

        <section className="side-card">
          <h2>Próxima camada da UI</h2>
          <p>
            O frontend já nasce com shell, estilo base e variáveis de ambiente para vocês plugaram
            autenticação, design system e módulos de negócio sem trocar a estrutura principal.
          </p>
          <div className="action-row">
            <button className="primary-button" type="button">Criar fluxo principal</button>
            <button className="secondary-button" type="button">Conectar API</button>
          </div>
        </section>
      </section>
    </main>
  )
}
`
}

function getNextEnvConfig() {
  return `export const publicEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  dataLayer: process.env.NEXT_PUBLIC_DATA_LAYER ?? 'none',
} as const
`
}

function getViteEnvConfig() {
  return `export const publicEnv = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api',
  dataLayer: import.meta.env.VITE_DATA_LAYER ?? 'none',
} as const
`
}

export function createNext(projectDir: string, answers: Answers) {
  const frontendDir = path.join(projectDir, 'apps', 'frontend')

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

  writeFile(path.join(frontendDir, '.env.local.example'), getNextEnvExample(answers))
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
    `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
    getNextEnvConfig(),
  )
  writeFile(
    path.join(frontendDir, 'app', 'layout.tsx'),
    `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '${answers.projectName}',
  description: 'Frontend genérico pronto para acelerar o início de produto.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
`,
  )
  writeFile(path.join(frontendDir, 'app', 'page.tsx'), getNextPage(answers))
  writeFile(path.join(frontendDir, 'app', 'globals.css'), getSharedStyles())
  writeFile(
    path.join(frontendDir, 'README.md'),
    `# Frontend Next.js

## Rodar

bash
cp .env.local.example .env.local
pnpm install
pnpm dev

## Destaques
- Integração com backend por NEXT_PUBLIC_API_URL
- Shell inicial pronto para produto
- Estrutura genérica para conectar qualquer estratégia de auth depois
`,
  )
}

export function createVite(projectDir: string, answers: Answers) {
  const frontendDir = path.join(projectDir, 'apps', 'frontend')

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

  writeFile(path.join(frontendDir, '.env.example'), getViteEnvExample(answers))
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
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
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
    getViteEnvConfig(),
  )
  writeFile(
    path.join(frontendDir, 'src', 'main.tsx'),
    `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
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
    `const metrics = [
  { label: 'Persistência', value: '${answers.dataLayer}' },
  { label: 'Backend URL', value: 'VITE_API_URL' },
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

        <section className="side-card">
          <h2>Próxima camada da UI</h2>
          <p>
            O scaffold deixa a base preparada para vocês plugaram autenticação, estado global,
            design system e regras de negócio no ritmo do produto.
          </p>
          <div className="action-row">
            <button className="primary-button" type="button">Criar fluxo principal</button>
            <button className="secondary-button" type="button">Conectar API</button>
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
`,
  )
  writeFile(path.join(frontendDir, 'src', 'index.css'), getSharedStyles())
  writeFile(
    path.join(frontendDir, 'README.md'),
    `# Frontend Vite

## Rodar

bash
cp .env.example .env
pnpm install
pnpm dev

## Destaques
- Integração com backend por VITE_API_URL
- Shell inicial pronto para produto
- Estrutura genérica para conectar qualquer estratégia de auth depois
`,
  )
}
