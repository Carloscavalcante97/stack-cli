import path from 'node:path'
import { writeFile } from '../utils/fs.js'
import type { Answers } from '../types.js'
import { usesPostgres } from '../types.js'

export function createRootFiles(projectDir: string, answers: Answers) {
  const hasNodeBackend = answers.backend === 'nest' || answers.backend === 'express'
  const hasFrontend = answers.frontend !== 'none'
  const hasTypeScript = hasNodeBackend || hasFrontend
  const apps = [
    ...(answers.backend !== 'none' ? ['backend'] : []),
    ...(hasFrontend ? ['frontend'] : []),
  ]

  writeFile(
    path.join(projectDir, '.gitignore'),
    `node_modules
dist
.next
coverage
.env
.env.local
.venv
__pycache__
*.pyc
.DS_Store
`,
  )

  writeFile(
    path.join(projectDir, '.editorconfig'),
    `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
`,
  )

  writeFile(
    path.join(projectDir, '.prettierrc'),
    `{
  "singleQuote": true,
  "semi": false,
  "trailingComma": "all"
}
`,
  )

  writeFile(
    path.join(projectDir, 'pnpm-workspace.yaml'),
    `packages:
  - apps/*
  - packages/*
`,
  )

  writeFile(
    path.join(projectDir, 'README.md'),
    `# ${answers.projectName}

Projeto gerado com o Create Stack CLI para servir como base genérica e rápida para novos produtos.

## Stack
- Backend: ${answers.backend}
- Frontend: ${answers.frontend}
- Persistência inicial: ${answers.dataLayer}
- Autenticação: ${answers.auth === 'firebase' ? 'Firebase Auth' : 'JWT próprio'}
- PostgreSQL local (docker-compose): ${answers.provisionPostgres ? 'sim' : 'não'}

## Arquitetura
- Workspace pnpm com apps isolados por responsabilidade.
- Backend em clean architecture com validação e DI.
- Frontend com env centralizado e interface inicial pronta para produto.
${answers.provisionPostgres ? '- Infra local em infra/docker.\n' : ''}
## Começando
1. Instale as dependências com \`pnpm install\`.
2. Em um clone novo, copie \`apps/backend/.env.example\` para \`apps/backend/.env\` e gere um segredo com \`openssl rand -base64 32\`.
3. Suba a infraestrutura local se necessário.
4. Rode backend e frontend por filtro do workspace.

## Comandos úteis
${[
  '- `pnpm dev` (todos os apps Node em paralelo)',
  ...(hasNodeBackend ? ['- `pnpm dev:backend`'] : []),
  ...(hasFrontend ? ['- `pnpm dev:frontend`'] : []),
  ...(answers.backend === 'fastapi' ? ['- `make dev` dentro de `apps/backend`'] : []),
  '- `pnpm build`',
  ...(hasTypeScript ? ['- `pnpm lint`', '- `pnpm test`'] : []),
  '- `pnpm format`',
].join('\n')}
${apps.length ? getDeployReadme(answers, apps) : ''}
## Integrações
- PostgreSQL habilitado: ${usesPostgres(answers) ? 'sim' : 'não'}
${answers.auth === 'firebase' ? '- Firebase Auth: para desenvolver sem projeto real, rode `firebase emulators:start --only auth --project demo-app` na raiz (veja o README de cada app).\n' : ''}`,
  )

  writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify(
      {
        name: answers.projectName,
        private: true,
        packageManager: 'pnpm@9.15.0',
        scripts: {
          dev: 'pnpm -r --parallel --if-present dev',
          ...(hasNodeBackend
            ? { 'dev:backend': 'pnpm --filter @apps/backend dev' }
            : {}),
          ...(hasFrontend
            ? { 'dev:frontend': 'pnpm --filter @apps/frontend dev' }
            : {}),
          build: 'pnpm -r --if-present build',
          ...(hasTypeScript
            ? { lint: 'eslint .', test: 'pnpm -r --if-present test' }
            : {}),
          format: 'prettier --write .',
          ...(answers.useHusky ? { prepare: 'husky' } : {}),
        },
        devDependencies: {
          prettier: '^3.4.2',
          ...(hasTypeScript
            ? {
                '@eslint/js': '^10.0.1',
                eslint: '^10.12.0',
                'typescript-eslint': '^8.71.2',
                typescript: '^5.7.2',
              }
            : {}),
          ...(hasFrontend ? { 'eslint-plugin-react-hooks': '^7.1.1' } : {}),
          ...(answers.useHusky
            ? { husky: '^9.1.7', 'lint-staged': '^15.2.10' }
            : {}),
        },
        ...(answers.useHusky
          ? {
              // Globs sem sobreposição: o lint-staged roda cada glob em paralelo
              'lint-staged': hasTypeScript
                ? {
                    '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
                    '*.{js,jsx,json,md}': ['prettier --write'],
                  }
                : { '*.{js,jsx,ts,tsx,json,md}': ['prettier --write'] },
            }
          : {}),
      },
      null,
      2,
    ),
  )

  if (answers.useHusky) {
    writeFile(path.join(projectDir, '.husky', 'pre-commit'), 'pnpm exec lint-staged\n')
  }

  if (hasTypeScript) {
    writeFile(
      path.join(projectDir, 'eslint.config.mjs'),
      `import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
${hasFrontend ? "import reactHooks from 'eslint-plugin-react-hooks'\n" : ''}import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['**/dist', '**/.next', '**/.venv', '**/next-env.d.ts'] },
  js.configs.recommended,
  tseslint.configs.recommended,${hasFrontend ? "\n  reactHooks.configs.flat.recommended," : ''}
  {
    rules: {
      // Prefixo _ marca parâmetro obrigatório sem uso (ex.: next do error handler do Express)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
`,
    )
  }

  if (apps.length) {
    writeFile(
      path.join(projectDir, '.dockerignore'),
      `.git
**/node_modules
**/dist
**/.next
**/.venv
**/__pycache__
**/.env
**/.env.local
`,
    )
    writeFile(path.join(projectDir, '.github', 'workflows', 'ci.yml'), getCiWorkflow(answers, apps))
  }

  if (answers.auth === 'firebase') {
    // Permite rodar o emulador de Auth sem projeto real: firebase emulators:start --only auth
    writeFile(
      path.join(projectDir, 'firebase.json'),
      `${JSON.stringify({ emulators: { auth: { port: 9099 } } }, null, 2)}\n`,
    )
  }
}

function getDeployReadme(answers: Answers, apps: string[]) {
  const name = answers.projectName
  const usesPrisma = usesPostgres(answers) && answers.backend !== 'fastapi'
  const frontendArg = answers.frontend === 'next' ? 'NEXT_PUBLIC_API_URL' : 'VITE_API_URL'
  return `
## Deploy
Cada app tem um \`Dockerfile\`. O build parte da raiz do monorepo:

\`\`\`bash
${apps
  .map((app) =>
    app === 'frontend'
      ? `docker build -f apps/frontend/Dockerfile --build-arg ${frontendArg}=https://api.exemplo.com/api -t ${name}-frontend .`
      : `docker build -f apps/backend/Dockerfile -t ${name}-backend .`,
  )
  .join('\n')}
\`\`\`

- O \`.env\` não entra na imagem: configure as variáveis no ambiente de produção.
${answers.frontend !== 'none' ? `- As variáveis públicas do frontend (\`${answers.frontend === 'next' ? 'NEXT_PUBLIC_' : 'VITE_'}*\`) entram no bundle no build: passe com \`--build-arg\`.\n` : ''}${usesPrisma ? '- O container do backend roda `prisma migrate deploy` antes de subir: commite `apps/backend/prisma/migrations`.\n' : ''}- O CI (\`.github/workflows/ci.yml\`) roda lint, testes, build e o build das imagens a cada push na \`main\` e em pull requests.
`
}

function getCiWorkflow(answers: Answers, apps: string[]) {
  const hasNodeApp = answers.backend !== 'fastapi' || answers.frontend !== 'none'
  const jobs = [
    ...(hasNodeApp
      ? [
          `  node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      # Versão do pnpm vem do packageManager do package.json
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build`,
        ]
      : []),
    ...(answers.backend === 'fastapi'
      ? [
          `  python:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/backend
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: '3.12'
          cache: pip
          cache-dependency-path: apps/backend/requirements*.txt
      - run: pip install -r requirements-dev.txt
      - run: ruff check .
      - run: pytest`,
        ]
      : []),
    `  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
${apps.map((app) => `      - run: docker build -f apps/${app}/Dockerfile .`).join('\n')}`,
  ]

  return `name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
${jobs.join('\n\n')}
`
}
