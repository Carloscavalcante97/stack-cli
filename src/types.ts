export type BackendOption = 'nest' | 'express' | 'fastapi' | 'none'
export type FrontendOption = 'next' | 'vite' | 'none'
export type DataLayerOption = 'postgres' | 'none'

export type Answers = {
  projectName: string
  backend: BackendOption
  frontend: FrontendOption
  dataLayer: DataLayerOption
  useHusky: boolean
  useDocker: boolean
  provisionPostgres: boolean
  useRedis: boolean
}

export function usesPostgres(answers: Pick<Answers, 'dataLayer'>) {
  return answers.dataLayer === 'postgres'
}
