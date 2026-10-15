export type BackendOption = 'nest' | 'express' | 'fastapi' | 'none'
export type FrontendOption = 'next' | 'vite' | 'none'
export type DataLayerOption = 'postgres' | 'none'
export type AuthOption = 'jwt' | 'firebase'

export type Answers = {
  projectName: string
  backend: BackendOption
  frontend: FrontendOption
  dataLayer: DataLayerOption
  auth: AuthOption
  useHusky: boolean
  // PostgreSQL local via infra/docker/docker-compose.yml
  provisionPostgres: boolean
}

export function usesPostgres(answers: Pick<Answers, 'dataLayer'>) {
  return answers.dataLayer === 'postgres'
}
