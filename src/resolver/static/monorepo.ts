import type { LibKnowledge } from '../../types.js'
import type { KnowledgeProvider } from '../types.js'

const TABLE: Record<string, Omit<LibKnowledge, 'name' | 'version'>> = {
  pnpm: {
    displayName: 'pnpm Workspaces', category: 'tooling',
    summary: 'pnpm monorepo workspaces',
    conventions: ['Use `pnpm --filter <pkg>` to run a script in one package.'],
    constraints: [],
    commands: ['pnpm -r build', 'pnpm --filter <pkg> dev', 'pnpm --filter <pkg> test'],
  },
  yarn: {
    displayName: 'Yarn Workspaces', category: 'tooling',
    summary: 'Yarn monorepo workspaces',
    conventions: [], constraints: [],
    commands: ['yarn workspaces run build', 'yarn workspace <pkg> dev'],
  },
  npm: {
    displayName: 'npm Workspaces', category: 'tooling',
    summary: 'npm monorepo workspaces',
    conventions: [], constraints: [],
    commands: ['npm -ws run build', 'npm -w <pkg> run dev'],
  },
  nx: {
    displayName: 'Nx', category: 'tooling',
    summary: 'Smart monorepo build system',
    conventions: [], constraints: [],
    commands: ['nx run <target>', 'nx affected --target=build', 'nx graph'],
  },
  turborepo: {
    displayName: 'Turborepo', category: 'tooling',
    summary: 'High-performance monorepo build system',
    conventions: [], constraints: [],
    commands: ['turbo run build', 'turbo run dev --filter=<pkg>'],
  },
  lerna: {
    displayName: 'Lerna', category: 'tooling',
    summary: 'JavaScript monorepo management',
    conventions: [], constraints: [],
    commands: ['lerna run build', 'lerna bootstrap'],
  },
  cargo: {
    displayName: 'Cargo Workspaces', category: 'tooling',
    summary: 'Cargo monorepo workspaces',
    conventions: [], constraints: [],
    commands: ['cargo build --workspace', 'cargo test --workspace', 'cargo build -p <crate>'],
  },
}

export const monorepoKnowledge: KnowledgeProvider = {
  name: 'static:monorepo',
  resolveMonorepo(mono) {
    const entry = TABLE[mono.tool]
    if (!entry) return null
    return { name: mono.tool, version: '', ...entry }
  },
}
