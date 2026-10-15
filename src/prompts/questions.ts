import { confirm, input, select } from '@inquirer/prompts'
import {
  type Answers,
  type AuthOption,
  type BackendOption,
  type DataLayerOption,
  type FrontendOption,
  usesPostgres,
} from '../types.js'

export async function askQuestions(): Promise<Answers> {
  const projectName = await input({
    message: 'Nome do projeto',
    validate: (value) =>
      /^[a-z0-9][a-z0-9._-]*$/.test(value)
        ? true
        : 'Use letras minúsculas, números, ".", "_" ou "-" (ex.: meu-app)',
  })

  const backend = await select<BackendOption>({
    message: 'Escolha o backend',
    choices: [
      { name: 'NestJS (TypeScript)', value: 'nest' },
      { name: 'Node + Express (TypeScript)', value: 'express' },
      { name: 'Python + FastAPI', value: 'fastapi' },
      { name: 'Nenhum', value: 'none' },
    ],
  })

  const frontend = await select<FrontendOption>({
    message: 'Escolha o frontend',
    choices: [
      { name: 'Next.js (TypeScript)', value: 'next' },
      { name: 'Vite + React (TypeScript)', value: 'vite' },
      { name: 'Nenhum', value: 'none' },
    ],
  })

  const hasBackend = backend !== 'none'

  const auth =
    hasBackend || frontend !== 'none'
      ? await select<AuthOption>({
          message: 'Escolha a autenticação',
          choices: [
            {
              name: hasBackend ? 'JWT próprio' : 'Nenhuma',
              value: 'jwt',
              description: hasBackend
                ? 'Cadastro, login e senha no backend'
                : 'Frontend sem login',
            },
            {
              name: 'Firebase Auth',
              value: 'firebase',
              description:
                'Login no frontend com o SDK do Firebase; o backend só verifica o ID token',
            },
          ],
        })
      : 'jwt'

  const dataLayer = hasBackend
    ? await select<DataLayerOption>({
        message: 'Escolha a persistência inicial do projeto',
        choices: [
          {
            name: 'PostgreSQL',
            value: 'postgres',
            description: 'Projeto já nasce pronto para persistência relacional',
          },
          {
            name: 'Nenhuma por enquanto',
            value: 'none',
            description: 'Scaffold sem banco inicial, com evolução livre depois',
          },
        ],
      })
    : 'none'

  const useHusky = await confirm({
    message: 'Deseja configurar Husky?',
    default: true,
  })

  const provisionPostgres =
    usesPostgres({ dataLayer }) &&
    (await confirm({
      message: 'Subir PostgreSQL local com docker-compose?',
      default: true,
    }))

  return {
    projectName,
    backend,
    frontend,
    dataLayer,
    auth,
    useHusky,
    provisionPostgres,
  }
}
