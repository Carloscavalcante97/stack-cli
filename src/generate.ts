import path from 'node:path'
import { createNest, createExpress, createFastApi } from './generators/backend.js'
import { createNext, createVite } from './generators/frontend.js'
import { createDockerCompose } from './generators/docker.js'
import { createRootFiles } from './generators/root.js'
import { tryRun } from './utils/exec.js'
import { ensureDir } from './utils/fs.js'
import type { Answers } from './types.js'

export function generateProject(
  projectDir: string,
  answers: Answers,
  onStep: (text: string) => void = () => {},
) {
  ensureDir(path.join(projectDir, 'apps'))
  ensureDir(path.join(projectDir, 'packages'))

  createRootFiles(projectDir, answers)
  createDockerCompose(projectDir, answers)

  if (answers.backend === 'nest') {
    onStep('Gerando backend NestJS com DTOs validados e DI...')
    createNest(projectDir, answers)
  }

  if (answers.backend === 'express') {
    onStep('Gerando backend Express com validação, JWT e DI...')
    createExpress(projectDir, answers)
  }

  if (answers.backend === 'fastapi') {
    onStep('Gerando backend FastAPI com response_model, JWT e DI...')
    createFastApi(projectDir, answers)
  }

  if (answers.frontend === 'next') {
    onStep('Gerando frontend Next.js com shell de produto...')
    createNext(projectDir, answers)
  }

  if (answers.frontend === 'vite') {
    onStep('Gerando frontend Vite com shell de produto...')
    createVite(projectDir, answers)
  }

  // git init antes do install: o script "prepare" do Husky precisa do .git
  onStep('Inicializando repositório Git...')
  tryRun('git init', projectDir)

  onStep('Instalando dependências do workspace...')
  tryRun('pnpm install', projectDir)
}
