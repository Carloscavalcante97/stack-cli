import { confirm, input, select } from '@inquirer/prompts'
import {
  type Answers,
  type BackendOption,
  type DataLayerOption,
  type FrontendOption,
  usesPostgres,
} from '../types.js'

export async function askQuestions(): Promise<Answers> {
  const projectName = await input({
    message: 'Nome do projeto',
    validate: (value) => (value.trim() ? true : 'Informe um nome'),
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

  const hasApplicationLayer = backend !== 'none' || frontend !== 'none'

  const dataLayer = hasApplicationLayer
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

  const useDocker = await confirm({
    message: 'Deseja docker-compose para infraestrutura local?',
    default: usesPostgres({ dataLayer }) || backend !== 'none',
  })

  const provisionPostgres = useDocker && usesPostgres({ dataLayer })
    ? await confirm({
        message: 'Provisionar PostgreSQL no docker-compose?',
        default: true,
      })
    : false

  const useRedis = useDocker && backend !== 'none'
    ? await confirm({
        message: 'Adicionar Redis no docker-compose?',
        default: false,
      })
    : false

  return {
    projectName,
    backend,
    frontend,
    dataLayer,
    useHusky,
    useDocker,
    provisionPostgres,
    useRedis,
  }
}
