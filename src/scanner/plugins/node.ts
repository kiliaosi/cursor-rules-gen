import fs from 'node:fs'
import path from 'node:path'
import type { MonorepoInfo, PackageManager, ProjectConfig, RawDep, ScannerPlugin, ScannerPluginResult } from '../../types.js'

function readPkg(root: string): Record<string, any> | null {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) } catch { return null }
}

function allDeps(pkg: Record<string, any>): Record<string, string> {
  return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.peerDependencies ?? {}) }
}

function parsePnpmCatalog(root: string): Record<string, string> {
  const wsPath = path.join(root, 'pnpm-workspace.yaml')
  if (!fs.existsSync(wsPath)) return {}
  const content = fs.readFileSync(wsPath, 'utf-8')
  const catalogMatch = content.match(/^catalog:\s*\n((?:\s+.+\n?)*)/m)
  if (!catalogMatch) return {}

  const map: Record<string, string> = {}
  for (const line of catalogMatch[1].split(/\r?\n/)) {
    const m = line.match(/^\s+['"]?([^'":\s]+)['"]?\s*:\s*(.+)$/)
    if (!m) continue
    const cleaned = m[2].trim().replace(/^['"]|['"]$/g, '')
    if (!cleaned.startsWith('#')) map[m[1]] = cleaned
  }
  return map
}

function cleanVersion(v: string): string {
  return v.replace(/^[\^~>=<\s]+/, '')
}

/** Secondary monorepo build tools that coexist with a workspaces manager. */
function detectExtraTools(root: string, deps: Record<string, string>): string[] {
  const tools: string[] = []
  if (fs.existsSync(path.join(root, 'nx.json')) || 'nx' in deps) tools.push('nx')
  if (fs.existsSync(path.join(root, 'turbo.json')) || 'turbo' in deps) tools.push('turborepo')
  if (fs.existsSync(path.join(root, 'lerna.json'))) tools.push('lerna')
  return tools
}

function detectMonorepo(root: string, pkg: Record<string, any>, deps: Record<string, string>): MonorepoInfo | null {
  const extraTools = detectExtraTools(root, deps)

  if (fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) {
    const content = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf-8')
    const section = content.match(/^packages:\s*\n((?:\s+-\s+.+\n?)*)/m)?.[1] ?? ''
    const workspaces = (section.match(/-\s+['"]?([^'"\n]+)['"]?/g) ?? [])
      .map((m: string) => m.replace(/^-\s+['"]?|['"]?$/g, '').trim())
      .filter(Boolean)
    return { tool: 'pnpm', workspaces, extraTools }
  }
  if (pkg.workspaces) {
    const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages ?? []
    return { tool: fs.existsSync(path.join(root, 'yarn.lock')) ? 'yarn' : 'npm', workspaces: ws, extraTools }
  }
  if (extraTools.includes('nx')) return { tool: 'nx', workspaces: [], extraTools: extraTools.filter(t => t !== 'nx') }
  if (extraTools.includes('turborepo')) return { tool: 'turborepo', workspaces: [], extraTools: extraTools.filter(t => t !== 'turborepo') }
  if (extraTools.includes('lerna')) return { tool: 'lerna', workspaces: [], extraTools: extraTools.filter(t => t !== 'lerna') }
  return null
}

function detectPackageManager(root: string): PackageManager {
  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) return 'bun'
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(root, 'package-lock.json'))) return 'npm'
  return 'unknown'
}

function detectConfig(root: string, pkg: Record<string, any>): ProjectConfig {
  const config: ProjectConfig = { tsStrict: false, isVscodeExtension: false }

  // --- package.json ---
  if (pkg.engines && typeof pkg.engines === 'object') {
    config.engines = {}
    for (const [k, v] of Object.entries(pkg.engines)) {
      if (typeof v === 'string') config.engines[k] = v
    }
  }
  if (pkg.type === 'module' || pkg.type === 'commonjs') {
    config.packageType = pkg.type
  }
  if (pkg.activationEvents || pkg.contributes) {
    config.isVscodeExtension = true
  }

  // --- tsconfig.json ---
  try {
    const raw = fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf-8')
    const tsconfig = JSON.parse(raw) as { compilerOptions?: Record<string, unknown> }
    const co = tsconfig.compilerOptions
    if (co) {
      config.tsStrict = co.strict === true
      if (typeof co.moduleResolution === 'string') config.tsModuleResolution = co.moduleResolution
      if (typeof co.target === 'string') config.tsTarget = co.target
    }
  } catch { /* no tsconfig — leave defaults */ }

  return config
}

export const nodeScanner: ScannerPlugin = {
  name: 'node',

  match(root) {
    return fs.existsSync(path.join(root, 'package.json'))
  },

  detect(root): ScannerPluginResult {
    const pkg = readPkg(root)
    if (!pkg) return { languages: [] }

    const rawDeps = allDeps(pkg)
    const catalog = parsePnpmCatalog(root)

    for (const [k, v] of Object.entries(rawDeps)) {
      if ((v === 'catalog:' || v.startsWith('catalog:')) && catalog[k]) rawDeps[k] = catalog[k]
    }
    for (const [k, v] of Object.entries(catalog)) {
      if (!(k in rawDeps)) rawDeps[k] = v
    }

    const hasTS = 'typescript' in rawDeps || fs.existsSync(path.join(root, 'tsconfig.json'))
    const pm = detectPackageManager(root)

    const deps: RawDep[] = Object.entries(rawDeps).map(([name, ver]) => ({
      name,
      version: cleanVersion(ver),
      ecosystem: 'node',
    }))

    const scripts = (pkg.scripts && typeof pkg.scripts === 'object')
      ? pkg.scripts as Record<string, string>
      : {}

    return {
      languages: [hasTS ? 'typescript' : 'javascript'],
      deps,
      packageManagers: pm !== 'unknown' ? [pm] : [],
      monorepo: detectMonorepo(root, pkg, rawDeps),
      scripts,
      config: detectConfig(root, pkg),
    }
  },
}
