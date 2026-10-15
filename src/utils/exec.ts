import { execSync } from 'node:child_process'
import chalk from 'chalk'

export function run(command: string, cwd: string) {
  execSync(command, { cwd, stdio: 'inherit' })
}

export function tryRun(command: string, cwd: string) {
  try {
    run(command, cwd)
  } catch {
    console.log(chalk.yellow(`Aviso: falha ao executar "${command}"`))
  }
}
