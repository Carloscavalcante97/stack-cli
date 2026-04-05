import path from 'node:path'
import { ensureDir, writeFile } from '../utils/fs.js'
import type { Answers } from '../types.js'
import { usesPostgres } from '../types.js'

export function createDockerCompose(projectDir: string, answers: Answers) {
  if (!answers.useDocker) return

  const dockerDir = path.join(projectDir, 'infra', 'docker')
  ensureDir(dockerDir)

  let content = 'services:\n'

  if (answers.provisionPostgres && usesPostgres(answers)) {
    content += `
  postgres:
    image: postgres:16
    container_name: ${answers.projectName}_postgres
    environment:
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB}
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data
`
  }

  if (answers.useRedis) {
    content += `
  redis:
    image: redis:7
    container_name: ${answers.projectName}_redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
`
  }

  if (!answers.provisionPostgres && !answers.useRedis) {
    content += `
  placeholder:
    image: alpine:3.20
    command: ["sh", "-c", "echo Nenhum serviço local selecionado"]
`
  }

  const volumes: string[] = []
  if (answers.provisionPostgres && usesPostgres(answers)) {
    volumes.push('  postgres_data:')
  }
  if (answers.useRedis) {
    volumes.push('  redis_data:')
  }

  if (volumes.length > 0) {
    content += `\nvolumes:\n${volumes.join('\n')}\n`
  }

  writeFile(path.join(dockerDir, 'docker-compose.yml'), content)

  const envLines = ['POSTGRES_USER=postgres', 'POSTGRES_PASSWORD=postgres', 'POSTGRES_DB=app_db']
  writeFile(path.join(dockerDir, '.env.example'), `${envLines.join('\n')}\n`)

  writeFile(
    path.join(dockerDir, 'README.md'),
    `# Docker

## Subir infraestrutura

\`\`\`bash
docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env up -d
\`\`\`

## Derrubar infraestrutura

\`\`\`bash
docker compose -f infra/docker/docker-compose.yml down
\`\`\`

## Serviços provisionados
- PostgreSQL: ${answers.provisionPostgres && usesPostgres(answers) ? 'sim' : 'não'}
- Redis: ${answers.useRedis ? 'sim' : 'não'}
`,
  )
}
