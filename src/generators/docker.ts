import path from 'node:path'
import { writeFile } from '../utils/fs.js'
import type { Answers } from '../types.js'

export function createDockerCompose(projectDir: string, answers: Answers) {
  if (!answers.provisionPostgres) return

  const dockerDir = path.join(projectDir, 'infra', 'docker')

  // ponytail: credenciais fixas de dev, iguais ao DATABASE_URL gerado no backend
  writeFile(
    path.join(dockerDir, 'docker-compose.yml'),
    `services:
  postgres:
    image: postgres:16
    container_name: ${answers.projectName}_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_db
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d app_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`,
  )

  writeFile(
    path.join(dockerDir, 'README.md'),
    `# Docker

PostgreSQL local para desenvolvimento.

## Subir

\`\`\`bash
docker compose -f infra/docker/docker-compose.yml up -d
\`\`\`

## Derrubar

\`\`\`bash
docker compose -f infra/docker/docker-compose.yml down
\`\`\`
`,
  )
}
