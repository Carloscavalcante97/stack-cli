#!/usr/bin/env node

import path from 'node:path'
import chalk from 'chalk'
import ora from 'ora'

import { askQuestions } from './prompts/questions.js'
import { generateProject } from './generate.js'
import { fileExists } from './utils/fs.js'
import { type Answers, usesPostgres } from './types.js'

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

function printSummary(answers: Answers) {
  const isNodeBackend = answers.backend === 'nest' || answers.backend === 'express'

  console.log('')
  console.log(chalk.green.bold('Projeto criado com sucesso!\n'))

  console.log(chalk.cyan('Stack selecionada'))
  console.log(`  • Backend: ${answers.backend}`)
  console.log(`  • Frontend: ${answers.frontend}`)
  console.log(`  • Persistência: ${answers.dataLayer}`)
  console.log(`  • Autenticação: ${answers.auth}`)
  console.log(`  • Husky: ${answers.useHusky ? 'sim' : 'não'}`)
  console.log(
    `  • PostgreSQL local (docker-compose): ${answers.provisionPostgres ? 'sim' : 'não'}`,
  )
  console.log('')

  console.log(chalk.yellow('Próximos passos'))
  console.log(`  cd ${answers.projectName}`)
  console.log('')

  if (answers.provisionPostgres) {
    console.log(chalk.magenta('Infra'))
    console.log('  docker compose -f infra/docker/docker-compose.yml up -d')
    console.log('')
  }

  if (usesPostgres(answers) && !answers.provisionPostgres) {
    console.log(chalk.magenta('PostgreSQL externo'))
    console.log('  Ajuste DATABASE_URL em apps/backend/.env')
    console.log('')
  }

  if (answers.backend === 'fastapi') {
    console.log(chalk.magenta('Backend FastAPI (Python >= 3.12)'))
    console.log('  cd apps/backend')
    console.log('  python3.12 -m venv .venv')
    console.log('  source .venv/bin/activate')
    console.log('  pip install -r requirements-dev.txt')
    console.log('  make dev')
    console.log('')
  }

  if (isNodeBackend) {
    console.log(chalk.magenta('Backend Node'))
    if (usesPostgres(answers)) {
      console.log('  pnpm --filter @apps/backend db:migrate')
    }
    console.log('  pnpm dev:backend')
    console.log('')
  }

  if (answers.frontend !== 'none') {
    console.log(chalk.magenta('Frontend'))
    console.log('  pnpm dev:frontend')
    console.log('')
  }

  if (answers.auth === 'firebase') {
    console.log(chalk.magenta('Firebase'))
    if (answers.backend !== 'none') {
      console.log('  Preencha FIREBASE_PROJECT_ID em apps/backend/.env')
    }
    if (answers.backend === 'fastapi') {
      console.log(
        '  Python exige credencial: GOOGLE_APPLICATION_CREDENTIALS apontando para a service account',
      )
    }
    if (answers.frontend !== 'none') {
      const envFile = answers.frontend === 'next' ? '.env.local' : '.env'
      console.log(
        `  Copie apps/frontend/${envFile}.example para ${envFile} e preencha a config web do Firebase`,
      )
    }
    console.log('')
  } else if (answers.backend !== 'none') {
    console.log(
      chalk.gray(
        'apps/backend/.env já foi gerado com um JWT_ACCESS_SECRET aleatório (fora do git).',
      ),
    )
    console.log('')
  }
}

async function main() {
  printBanner()

  const answers = await askQuestions()
  const projectDir = path.resolve(answers.projectName)

  if (fileExists(projectDir)) {
    console.log(chalk.red(`\nErro: o diretório já existe:\n${projectDir}\n`))
    process.exit(1)
  }

  const spinner = ora('Gerando estrutura do projeto...').start()

  try {
    generateProject(projectDir, answers, (text) => {
      spinner.text = text
    })
    spinner.succeed('Projeto gerado com sucesso')
    printSummary(answers)
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
