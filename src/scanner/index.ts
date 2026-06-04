import fs from 'node:fs'
import path from 'node:path'
import type {
  Language, PackageManager, RawDep, ScanResult,
  ScannerPlugin, ScannerPluginResult,
} from '../types.js'
import { scannerPlugins } from './registry.js'

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function empty(): ScanResult {
  return {
    languages: [], packageManagers: [], monorepo: null,
    srcDir: null, ci: null, containerized: false,
    deps: [], subProjects: [], scripts: {},
    config: { tsStrict: false, isVscodeExtension: false },
  }
}

function addUniqueBy<T>(target: T[], source: T[], keyOf: (t: T) => string) {
  const seen = new Set(target.map(keyOf))
  for (const item of source) {
    const k = keyOf(item)
    if (!seen.has(k)) { target.push(item); seen.add(k) }
  }
}

function mergePluginResult(acc: ScanResult, pr: ScannerPluginResult) {
  addUniqueBy(acc.languages as string[], pr.languages, l => l)
  if (pr.deps) addUniqueBy(acc.deps, pr.deps, d => `${d.ecosystem}:${d.name}`)
  if (pr.packageManagers) {
    addUniqueBy(
      acc.packageManagers as string[],
      pr.packageManagers.filter(p => p !== 'unknown') as string[],
      p => p,
    )
  }
  if (pr.monorepo && !acc.monorepo) acc.monorepo = pr.monorepo
  if (pr.ci && !acc.ci) acc.ci = pr.ci
  if (pr.containerized && !acc.containerized) acc.containerized = pr.containerized
  if (pr.scripts) for (const [k, v] of Object.entries(pr.scripts)) acc.scripts[k] ??= v

  // Merge config facts — first plugin that sets a field wins.
  if (pr.config) {
    const c = pr.config
    if (!acc.config.engines && c.engines) acc.config.engines = c.engines
    if (!acc.config.packageType && c.packageType) acc.config.packageType = c.packageType
    if (!acc.config.tsStrict && c.tsStrict) acc.config.tsStrict = c.tsStrict
    if (!acc.config.tsModuleResolution && c.tsModuleResolution) acc.config.tsModuleResolution = c.tsModuleResolution
    if (!acc.config.tsTarget && c.tsTarget) acc.config.tsTarget = c.tsTarget
    if (!acc.config.isVscodeExtension && c.isVscodeExtension) acc.config.isVscodeExtension = c.isVscodeExtension
  }
}

function detectSrcDir(root: string): string | null {
  for (const dir of ['src', 'app', 'lib', 'source', 'pages']) {
    const p = path.join(root, dir)
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return dir
  }
  return null
}

// ---------------------------------------------------------------------------
// Scanner engine
// ---------------------------------------------------------------------------

function scanSingle(root: string, plugins: ScannerPlugin[]): ScanResult {
  const result = empty()
  for (const plugin of plugins) {
    if (plugin.match(root)) mergePluginResult(result, plugin.detect(root))
  }
  if (result.languages.length === 0) result.languages.push('unknown' as Language)
  if (result.packageManagers.length === 0) result.packageManagers.push('unknown' as PackageManager)
  result.srcDir = detectSrcDir(root)
  return result
}

const PROJECT_MARKERS = [
  'package.json', 'pyproject.toml', 'requirements.txt',
  'go.mod', 'Cargo.toml', 'pubspec.yaml',
]

const SKIP_DIRS = new Set(['node_modules', 'vendor', '__pycache__', 'dist', 'build', 'target'])

function isSubProject(p: string): boolean {
  return PROJECT_MARKERS.some(m => fs.existsSync(path.join(p, m)))
}

function rollupSubprojectInto(base: ScanResult, sub: ScanResult) {
  addUniqueBy(base.languages as string[], sub.languages, l => l)
  addUniqueBy(base.deps, sub.deps, d => `${d.ecosystem}:${d.name}`)
  addUniqueBy(
    base.packageManagers as string[],
    sub.packageManagers.filter(p => p !== 'unknown') as string[],
    p => p,
  )
  if (!base.ci && sub.ci) base.ci = sub.ci
  if (!base.containerized && sub.containerized) base.containerized = sub.containerized
}

/**
 * Resolve sub-project directories. When the root declares monorepo workspaces
 * (e.g. `apps/*`, `packages/*`), expand those globs so nested packages are
 * found. Otherwise fall back to scanning first-level directories.
 */
function resolveSubProjectDirs(root: string, monorepo: ScanResult['monorepo']): string[] {
  const patterns = monorepo?.workspaces ?? []
  if (patterns.length > 0) return expandWorkspaces(root, patterns)

  const dirs: string[] = []
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
      dirs.push(entry.name)
    }
  } catch { /* root not readable */ }
  return dirs
}

/** Expand workspace glob patterns to concrete first-level package dirs. */
function expandWorkspaces(root: string, patterns: string[]): string[] {
  const out = new Set<string>()
  for (const raw of patterns) {
    const pattern = raw.replace(/^\.\//, '')
    if (pattern.startsWith('!')) continue // negations are rare; ignore

    if (pattern.endsWith('/*') || pattern.endsWith('/**')) {
      const parent = pattern.replace(/\/\*\*?$/, '')
      const parentPath = path.join(root, parent)
      try {
        for (const entry of fs.readdirSync(parentPath, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
          out.add(path.join(parent, entry.name).replace(/\\/g, '/'))
        }
      } catch { /* parent missing */ }
    } else {
      out.add(pattern.replace(/\\/g, '/'))
    }
  }
  return [...out]
}

export interface ScanOptions {
  /** Override the plugin registry (testing / extension) */
  plugins?: ScannerPlugin[]
}

/** Scan root + sub-projects (monorepo workspaces or first-level dirs). */
export function scan(root: string, options: ScanOptions = {}): ScanResult {
  const plugins = options.plugins ?? scannerPlugins
  const result = scanSingle(root, plugins)

  const concretePackages: string[] = []
  for (const rel of resolveSubProjectDirs(root, result.monorepo)) {
    const subPath = path.join(root, rel)
    if (!isSubProject(subPath)) continue

    const sub = scanSingle(subPath, plugins)
    rollupSubprojectInto(result, sub)
    concretePackages.push(rel)

    if (sub.languages.length > 0 && sub.languages[0] !== 'unknown') {
      result.subProjects.push({
        name: path.basename(rel),
        path: rel,
        languages: sub.languages,
        deps: sub.deps,
      })
    }
  }

  // Replace glob patterns with the concrete packages they expanded to, so the
  // "N workspaces" count reflects real packages rather than glob entries.
  if (result.monorepo && concretePackages.length > 0) {
    result.monorepo = { ...result.monorepo, workspaces: concretePackages }
  }

  // Drop sentinel 'unknown' when concrete values exist
  if (result.languages.length > 1) {
    result.languages = result.languages.filter(l => l !== 'unknown')
  }
  const realPMs = result.packageManagers.filter(p => p !== 'unknown')
  if (realPMs.length > 0) result.packageManagers = realPMs

  return result
}

// Convenience re-exports
export type { RawDep, ScanResult }
