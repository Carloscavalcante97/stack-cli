#!/usr/bin/env node

import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'
import ora from 'ora'

import { askQuestions } from './prompts/questions.js'
import {
  createNest,
  createExpress,
  createFastApi,
} from './generators/backend.js'
import { createNext, createVite } from './generators/frontend.js'
import { createDockerCompose } from './generators/docker.js'
import { setupHusky } from './generators/husky.js'
import { createRootFiles } from './generators/root.js'
import { tryRun } from './utils/exec.js'
import { ensureDir, fileExists } from './utils/fs.js'
import { usesPostgres } from './types.js'

const baseDir = path.join(os.homedir(), 'projects')

function printBanner() {
  console.log('\n')
  console.log(chalk.cyan.bold('Create Stack CLI'))
  console.log(
    chalk.gray(
      'Scaffold interativo para stacks modernas com backend validado, DI e base pronta para evoluir',
    ),
  )
  console.log('')
}

function printSummary(
  projectDir: string,
  answers: Awaited<ReturnType<typeof askQuestions>>,
) {
  console.log('')
  console.log(chalk.green.bold('Projeto criado com sucesso!\n'))

  console.log(chalk.cyan('Stack selecionada'))
  console.log(`  • Backend: ${answers.backend}`)
  console.log(`  • Frontend: ${answers.frontend}`)
  console.log(`  • Persistência: ${answers.dataLayer}`)
  console.log(`  • Husky: ${answers.useHusky ? 'sim' : 'não'}`)
  console.log(`  • Docker: ${answers.useDocker ? 'sim' : 'não'}`)
  console.log(
    `  • PostgreSQL local: ${answers.provisionPostgres ? 'sim' : 'não'}`,
  )
  console.log(`  • Redis: ${answers.useRedis ? 'sim' : 'não'}`)
  console.log('')

  console.log(chalk.cyan('Arquitetura base'))
  console.log(
    '  • apps/backend com camadas domain/application/infra/presentation',
  )
  console.log(
    '  • apps/frontend com env centralizado e interface inicial pronta para produto',
  )
  console.log('  • infra/docker para serviços locais')
  console.log('  • workspace pnpm pronto para evolução por app')
  console.log('')

  console.log(chalk.yellow('Importante'))
  console.log(
    '  Antes de rodar qualquer app, copie os arquivos de ambiente .env/.env.local a partir dos exemplos gerados.',
  )
  console.log('')

  console.log(chalk.yellow('Próximos passos'))
  console.log(`  cd ${projectDir}`)
  console.log(
    '  cp apps/backend/.env.example apps/backend/.env  # se existir backend',
  )

  if (answers.frontend !== 'none') {
    if (answers.frontend === 'next') {
      console.log(
        '  cp apps/frontend/.env.local.example apps/frontend/.env.local',
      )
    } else {
      console.log('  cp apps/frontend/.env.example apps/frontend/.env')
    }
  }

  if (answers.useDocker) {
    console.log('  cp infra/docker/.env.example infra/docker/.env')
  }

  console.log('  pnpm install')
  console.log('')

  if (answers.backend === 'fastapi') {
    console.log(chalk.magenta('Backend FastAPI'))
    console.log('  cd apps/backend')
    console.log('  python3 -m venv .venv')
    console.log('  source .venv/bin/activate')
    console.log('  pip install -r requirements.txt')
    console.log('  uvicorn app.main:app --reload --port 3001')
    console.log('')
  }

  if (answers.backend === 'nest' || answers.backend === 'express') {
    console.log(chalk.magenta('Backend Node'))
    if (usesPostgres(answers)) {
      console.log('  pnpm --filter @apps/backend db:generate')
      console.log('  pnpm --filter @apps/backend db:migrate')
    }
    console.log('  pnpm --filter @apps/backend dev')
    console.log('')
  }

  if (answers.frontend === 'next' || answers.frontend === 'vite') {
    console.log(chalk.magenta('Frontend'))
    console.log('  pnpm --filter @apps/frontend dev')
    console.log('')
  }

  if (answers.useDocker) {
    console.log(chalk.magenta('Infra'))
    console.log(
      '  docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env up -d',
    )
    console.log('')
  }

  if (usesPostgres(answers) && !answers.provisionPostgres) {
    console.log(chalk.magenta('PostgreSQL externo'))
    console.log('  Defina DATABASE_URL manualmente em apps/backend/.env')
    console.log('')
  }

  console.log(
    chalk.gray(
      'O scaffold já nasce com validação, separação de camadas e base para produção.',
    ),
  )
  console.log('')
}

async function main() {
  printBanner()

  const answers = await askQuestions()
  const projectDir = path.join(baseDir, answers.projectName)

  if (fileExists(projectDir)) {
    console.log(chalk.red(`\nErro: o diretório já existe:\n${projectDir}\n`))
    process.exit(1)
  }

  const spinner = ora('Gerando estrutura do projeto...').start()

  try {
    ensureDir(projectDir)
    ensureDir(path.join(projectDir, 'apps'))
    ensureDir(path.join(projectDir, 'packages'))
    ensureDir(path.join(projectDir, 'infra'))

    createRootFiles(projectDir, answers)
    createDockerCompose(projectDir, answers)

    if (answers.backend === 'nest') {
      spinner.text = 'Gerando backend NestJS com DTOs validados e DI...'
      createNest(projectDir, answers)
    }

    if (answers.backend === 'express') {
      spinner.text = 'Gerando backend Express com validação, JWT e DI...'
      createExpress(projectDir, answers)
    }

    if (answers.backend === 'fastapi') {
      spinner.text = 'Gerando backend FastAPI com response_model, JWT e DI...'
      createFastApi(projectDir, answers)
    }

    if (answers.frontend === 'next') {
      spinner.text = 'Gerando frontend Next.js com shell de produto...'
      createNext(projectDir, answers)
    }

    if (answers.frontend === 'vite') {
      spinner.text = 'Gerando frontend Vite com shell de produto...'
      createVite(projectDir, answers)
    }

    spinner.text = 'Instalando dependências do workspace...'
    tryRun('pnpm install', projectDir)

    if (answers.useHusky) {
      spinner.text = 'Configurando Husky e lint-staged...'
      setupHusky(projectDir)
    }

    spinner.text = 'Inicializando repositório Git...'
    tryRun('git init', projectDir)

    spinner.succeed('Projeto gerado com sucesso')
    printSummary(projectDir, answers)
  } catch (error) {
    spinner.fail('Falha ao gerar o projeto')
    console.error(chalk.red('\nErro ao criar projeto:\n'))
    console.error(error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(chalk.red('\nErro inesperado:\n'))
  console.error(error)
  process.exit(1)
})
