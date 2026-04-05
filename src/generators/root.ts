import path from 'node:path'
import { writeFile } from '../utils/fs.js'
import type { Answers } from '../types.js'
import { usesPostgres } from '../types.js'

export function createRootFiles(projectDir: string, answers: Answers) {
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
pnpm-lock.yaml
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
- Docker: ${answers.useDocker ? 'sim' : 'não'}
- PostgreSQL local: ${answers.provisionPostgres ? 'sim' : 'não'}
- Redis: ${answers.useRedis ? 'sim' : 'não'}

## Arquitetura
- Workspace pnpm com apps isolados por responsabilidade.
- Backend em clean architecture com validação e DI.
- Frontend com env centralizado e interface inicial pronta para produto.
- Infra local em infra/docker.

## Começando
1. Instale as dependências com pnpm install.
2. Copie os arquivos de ambiente de cada app.
3. Suba a infraestrutura local se necessário.
4. Rode backend e frontend por filtro do workspace.

## Comandos úteis
- pnpm dev:backend
- pnpm dev:frontend
- pnpm build
- pnpm format

## Integrações
- PostgreSQL habilitado: ${usesPostgres(answers) ? 'sim' : 'não'}
`,
  )

  writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify(
      {
        name: answers.projectName,
        private: true,
        packageManager: 'pnpm@9.15.0',
        scripts: {
          dev: 'echo "Use pnpm dev:backend ou pnpm dev:frontend"',
          'dev:backend': 'pnpm --filter @apps/backend dev',
          'dev:frontend': 'pnpm --filter @apps/frontend dev',
          build: 'pnpm -r --if-present build',
          format: 'prettier --write .',
          lint: 'pnpm -r --if-present lint',
        },
        devDependencies: {
          prettier: '^3.4.2',
        },
      },
      null,
      2,
    ),
  )
}
