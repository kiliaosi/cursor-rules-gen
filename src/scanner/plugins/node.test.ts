import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { nodeScanner } from './node.js'
import type { ScannerPluginResult } from '../../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(__dirname, '__fixtures__')

function fixture(name: string): string {
  return path.join(FIXTURES, name)
}

function detect(fixtureName: string): ScannerPluginResult {
  const root = fixture(fixtureName)
  if (!nodeScanner.match(root)) throw new Error(`Fixture ${fixtureName} not matched by nodeScanner`)
  return nodeScanner.detect(root)
}

beforeAll(() => {
  fs.mkdirSync(FIXTURES, { recursive: true })

  // basic: Node project with tsconfig, engines, paths
  const basic = fixture('basic')
  fs.mkdirSync(basic, { recursive: true })
  fs.writeFileSync(path.join(basic, 'package.json'), JSON.stringify({
    name: 'test', type: 'module',
    engines: { node: '>=18' },
    dependencies: { react: '^18.0.0' },
    devDependencies: { typescript: '^5.0.0', vitest: '^2.0.0' },
    scripts: { build: 'tsc', test: 'vitest' },
  }))
  fs.writeFileSync(path.join(basic, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { strict: true, moduleResolution: 'bundler', target: 'ES2022', paths: { '@/*': ['src/*'] } },
  }))
  fs.writeFileSync(path.join(basic, 'package-lock.json'), '')

  // tsup-proj
  const tsupProj = fixture('tsup-proj')
  fs.mkdirSync(tsupProj, { recursive: true })
  fs.writeFileSync(path.join(tsupProj, 'package.json'), JSON.stringify({
    name: 'tsup-lib', dependencies: {}, devDependencies: { tsup: '^8.0.0' }, scripts: { build: 'tsup' },
  }))
  fs.writeFileSync(path.join(tsupProj, 'tsup.config.ts'), `
import { defineConfig } from 'tsup'
export default defineConfig([
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    target: 'node18',
  },
  {
    entry: { extension: 'src/extension.ts' },
    format: ['cjs'],
  },
])
`)
  fs.writeFileSync(path.join(tsupProj, 'package-lock.json'), '')

  // vscode-ext
  const vscodeExt = fixture('vscode-ext')
  fs.mkdirSync(vscodeExt, { recursive: true })
  fs.writeFileSync(path.join(vscodeExt, 'package.json'), JSON.stringify({
    name: 'my-ext', activationEvents: ['onStartupFinished'], contributes: { commands: [{}] }, dependencies: {},
  }))
  fs.writeFileSync(path.join(vscodeExt, '.vscodeignore'), 'node_modules\nsrc\n')
  fs.writeFileSync(path.join(vscodeExt, 'package-lock.json'), '')

  // pnpm-ws
  const pnpmWs = fixture('pnpm-ws')
  fs.mkdirSync(pnpmWs, { recursive: true })
  fs.writeFileSync(path.join(pnpmWs, 'package.json'), JSON.stringify({ name: 'mono', dependencies: {} }))
  fs.writeFileSync(path.join(pnpmWs, 'pnpm-workspace.yaml'), `
packages:
  - 'apps/*'
  - 'packages/*'
catalog:
  react: ^18.0.0
  typescript: ^5.0.0
`)
  fs.writeFileSync(path.join(pnpmWs, 'pnpm-lock.yaml'), '')

  // minimal
  const minimal = fixture('minimal')
  fs.mkdirSync(minimal, { recursive: true })
  fs.writeFileSync(path.join(minimal, 'package.json'), JSON.stringify({ name: 'bare', dependencies: {} }))
  fs.writeFileSync(path.join(minimal, 'package-lock.json'), '')
})

afterAll(() => {
  fs.rmSync(FIXTURES, { recursive: true, force: true })
})

describe('nodeScanner', () => {
  it('detects TypeScript when tsconfig.json exists', () => {
    const r = detect('basic')
    expect(r.languages).toContain('typescript')
  })

  it('detects engines and module type', () => {
    const r = detect('basic')
    expect(r.config?.engines).toEqual({ node: '>=18' })
    expect(r.config?.packageType).toBe('module')
  })

  it('extracts tsconfig compiler options', () => {
    const r = detect('basic')
    expect(r.config?.tsStrict).toBe(true)
    expect(r.config?.tsModuleResolution).toBe('bundler')
    expect(r.config?.tsTarget).toBe('ES2022')
  })

  it('extracts tsconfig paths', () => {
    const r = detect('basic')
    expect(r.config?.tsconfigPaths).toEqual({ '@/*': ['src/*'] })
  })

  it('detects dependencies', () => {
    const r = detect('basic')
    const names = r.deps?.map(d => d.name) ?? []
    expect(names).toContain('react')
    expect(names).toContain('typescript')
    expect(names).toContain('vitest')
  })

  it('extracts package.json scripts', () => {
    const r = detect('basic')
    expect(r.scripts).toEqual({ build: 'tsc', test: 'vitest' })
  })

  it('detects npm package manager from package-lock.json', () => {
    const r = detect('basic')
    expect(r.packageManagers).toContain('npm')
  })

  it('extracts tsup config entries', () => {
    const r = detect('tsup-proj')
    expect(r.config?.tsupConfig.exists).toBe(true)
    expect(r.config?.tsupConfig.entries).toContain('cli')
    expect(r.config?.tsupConfig.entries).toContain('extension')
  })

  it('extracts tsup config formats', () => {
    const r = detect('tsup-proj')
    expect(r.config?.tsupConfig.formats).toContain('esm')
    expect(r.config?.tsupConfig.formats).toContain('cjs')
  })

  it('extracts tsup config target', () => {
    const r = detect('tsup-proj')
    expect(r.config?.tsupConfig.target).toBe('node18')
  })

  it('detects VSCode extension', () => {
    const r = detect('vscode-ext')
    expect(r.config?.isVscodeExtension).toBe(true)
  })

  it('detects .vscodeignore', () => {
    const r = detect('vscode-ext')
    expect(r.config?.hasVscodeignore).toBe(true)
  })

  it('detects pnpm workspace', () => {
    const r = detect('pnpm-ws')
    expect(r.packageManagers).toContain('pnpm')
    expect(r.monorepo?.tool).toBe('pnpm')
    expect(r.monorepo?.workspaces).toHaveLength(2)
  })

  it('defaults to javascript when no TypeScript dep or tsconfig', () => {
    const r = detect('minimal')
    expect(r.languages).toContain('javascript')
    expect(r.languages).not.toContain('typescript')
  })

  it('defaults config when no tsconfig exists', () => {
    const r = detect('minimal')
    expect(r.config?.tsStrict).toBe(false)
    expect(r.config?.tsupConfig.exists).toBe(false)
    expect(r.config?.hasVscodeignore).toBe(false)
  })
})
