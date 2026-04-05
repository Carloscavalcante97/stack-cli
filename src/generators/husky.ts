import fs from 'node:fs'
import path from 'node:path'
import { tryRun } from '../utils/exec.js'
import { fileExists, writeFile } from '../utils/fs.js'

export function setupHusky(projectDir: string) {
  const pkgPath = path.join(projectDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<
    string,
    any
  >

  pkg.scripts = {
    ...pkg.scripts,
    prepare: 'husky',
    lint: 'echo "Configure seu lint por app"',
  }

  pkg['lint-staged'] = {
    '*.{js,jsx,ts,tsx,json,md}': ['prettier --write'],
  }

  pkg.devDependencies = {
    ...(pkg.devDependencies ?? {}),
    husky: '^9.1.7',
    'lint-staged': '^15.2.10',
    prettier: '^3.4.2',
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8')

  tryRun('pnpm install', projectDir)
  tryRun('pnpm exec husky init', projectDir)

  const preCommitPath = path.join(projectDir, '.husky', 'pre-commit')

  if (fileExists(preCommitPath)) {
    writeFile(
      preCommitPath,
      `pnpm exec lint-staged
`,
    )
    tryRun(`chmod +x "${preCommitPath}"`, projectDir)
  }
}
