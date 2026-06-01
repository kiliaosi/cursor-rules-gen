import fs from 'node:fs'
import path from 'node:path'
import type { ScannerPlugin, ScannerPluginResult } from '../../types.js'

const CI_FILES: Array<[string, string]> = [
  ['.github/workflows', 'GitHub Actions'],
  ['.gitlab-ci.yml', 'GitLab CI'],
  ['Jenkinsfile', 'Jenkins'],
  ['.circleci', 'CircleCI'],
  ['azure-pipelines.yml', 'Azure Pipelines'],
  ['.travis.yml', 'Travis CI'],
]

const CONTAINER_FILES = [
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  'compose.yml', 'compose.yaml',
]

function detectCI(root: string): string | null {
  for (const [file, name] of CI_FILES) {
    if (fs.existsSync(path.join(root, file))) return name
  }
  return null
}

function detectContainerized(root: string): boolean {
  return CONTAINER_FILES.some(f => fs.existsSync(path.join(root, f)))
}

/** Cross-cutting scanner for language-agnostic signals (CI/CD, containers). */
export const genericScanner: ScannerPlugin = {
  name: 'generic',

  match() {
    return true
  },

  detect(root): ScannerPluginResult {
    return {
      languages: [],
      ci: detectCI(root),
      containerized: detectContainerized(root),
    }
  },
}
