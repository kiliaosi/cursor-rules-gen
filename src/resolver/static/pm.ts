import type { LibKnowledge, PackageManager } from '../../types.js'
import type { KnowledgeProvider } from '../types.js'

const TABLE: Partial<Record<PackageManager, Omit<LibKnowledge, 'name' | 'version'>>> = {
  pnpm: {
    displayName: 'pnpm', category: 'tooling',
    summary: 'Fast, disk-efficient JavaScript package manager',
    conventions: [], constraints: [],
    commands: ['pnpm install', 'pnpm dev', 'pnpm build', 'pnpm test'],
  },
  yarn: {
    displayName: 'Yarn', category: 'tooling',
    summary: 'JavaScript package manager',
    conventions: [], constraints: [],
    commands: ['yarn install', 'yarn dev', 'yarn build', 'yarn test'],
  },
  npm: {
    displayName: 'npm', category: 'tooling',
    summary: 'Node.js default package manager',
    conventions: [], constraints: [],
    commands: ['npm install', 'npm run dev', 'npm run build', 'npm test'],
  },
  bun: {
    displayName: 'Bun', category: 'tooling',
    summary: 'All-in-one JavaScript runtime and toolkit',
    conventions: [], constraints: [],
    commands: ['bun install', 'bun dev', 'bun build', 'bun test'],
  },
  uv: {
    displayName: 'uv', category: 'tooling',
    summary: 'Fast Python package and project manager',
    conventions: [], constraints: [],
    commands: ['uv sync', 'uv run python main.py', 'uv run pytest'],
  },
  poetry: {
    displayName: 'Poetry', category: 'tooling',
    summary: 'Python dependency management and packaging',
    conventions: [], constraints: [],
    commands: ['poetry install', 'poetry run pytest'],
  },
  pdm: {
    displayName: 'PDM', category: 'tooling',
    summary: 'Modern Python package manager',
    conventions: [], constraints: [],
    commands: ['pdm install', 'pdm run pytest'],
  },
  pip: {
    displayName: 'pip', category: 'tooling',
    summary: 'Python package installer',
    conventions: [], constraints: [],
    commands: ['pip install -r requirements.txt', 'pytest'],
  },
}

export const packageManagerKnowledge: KnowledgeProvider = {
  name: 'static:pm',
  resolvePackageManager(pm) {
    const entry = TABLE[pm]
    if (!entry) return null
    return { name: pm, version: '', ...entry }
  },
}
