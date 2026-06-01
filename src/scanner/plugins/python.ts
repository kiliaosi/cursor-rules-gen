import fs from 'node:fs'
import path from 'node:path'
import type { PackageManager, RawDep, ScannerPlugin, ScannerPluginResult } from '../../types.js'

function tryRead(root: string, file: string): string | null {
  try { return fs.readFileSync(path.join(root, file), 'utf-8') } catch { return null }
}

function readRequirements(root: string): string | null {
  for (const name of ['requirements.txt', 'requirements/base.txt', 'requirements/prod.txt']) {
    const content = tryRead(root, name)
    if (content) return content
  }
  return null
}

function collectDeps(root: string): RawDep[] {
  const deps: RawDep[] = []
  const seen = new Set<string>()

  const add = (name: string, version = '') => {
    const normalized = name.toLowerCase().replace(/-/g, '_')
    if (seen.has(normalized)) return
    seen.add(normalized)
    deps.push({ name: normalized, version, ecosystem: 'python' })
  }

  const pyproject = tryRead(root, 'pyproject.toml')
  if (pyproject) {
    const matches = pyproject.matchAll(/["']([a-zA-Z0-9_-]+)(?:\[.*?\])?(?:([><=!~]+[^"',\s]+))?["']/g)
    for (const m of matches) add(m[1], m[2]?.replace(/^[><=!~]+/, '') ?? '')
  }

  const reqs = readRequirements(root)
  if (reqs) {
    for (const line of reqs.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#') || t.startsWith('-')) continue
      const m = t.match(/^([a-zA-Z0-9_-]+)(?:\[.*?\])?(?:([><=!~]+)(.+))?/)
      if (m) add(m[1], m[3]?.trim() ?? '')
    }
  }

  const setup = tryRead(root, 'setup.py')
  if (setup) {
    const matches = setup.matchAll(/["']([a-zA-Z0-9_-]+)(?:\[.*?\])?(?:([><=!~]+[^"']+))?["']/g)
    for (const m of matches) add(m[1], m[2]?.replace(/^[><=!~]+/, '') ?? '')
  }

  return deps
}

function detectPM(root: string): PackageManager {
  if (fs.existsSync(path.join(root, 'uv.lock'))) return 'uv'
  if (fs.existsSync(path.join(root, 'pdm.lock'))) return 'pdm'
  if (fs.existsSync(path.join(root, 'poetry.lock'))) return 'poetry'
  if (fs.existsSync(path.join(root, 'Pipfile.lock')) || fs.existsSync(path.join(root, 'Pipfile'))) return 'pip'
  if (fs.existsSync(path.join(root, 'environment.yml'))) return 'conda'
  return 'pip'
}

const MARKERS = ['pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg', 'Pipfile']

export const pythonScanner: ScannerPlugin = {
  name: 'python',

  match(root) {
    return MARKERS.some(f => fs.existsSync(path.join(root, f)))
  },

  detect(root): ScannerPluginResult {
    return {
      languages: ['python'],
      deps: collectDeps(root),
      packageManagers: [detectPM(root)],
    }
  },
}
