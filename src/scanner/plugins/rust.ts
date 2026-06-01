import fs from 'node:fs'
import path from 'node:path'
import type { MonorepoInfo, RawDep, ScannerPlugin, ScannerPluginResult } from '../../types.js'

function extractDeps(cargo: string): RawDep[] {
  const deps: RawDep[] = []
  const seen = new Set<string>()

  for (const section of cargo.matchAll(/\[((?:dev-|build-)?dependencies(?:\.[^\]]+)?)\]([\s\S]*?)(?=\n\[|$)/g)) {
    for (const line of section[2].split(/\r?\n/)) {
      const m = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]+)"|.*version\s*=\s*"([^"]+)")/)
      if (!m || m[1].startsWith('#')) continue
      const name = m[1].replace(/-/g, '_')
      const version = (m[2] ?? m[3] ?? '').replace(/^[\^~>=<\s]+/, '')
      if (seen.has(name)) continue
      seen.add(name)
      deps.push({ name, version, ecosystem: 'rust' })
    }
  }
  return deps
}

function detectWorkspace(cargo: string): MonorepoInfo | null {
  if (!cargo.match(/\[workspace\]/)) return null
  const members = cargo.match(/members\s*=\s*\[([\s\S]*?)\]/)
  if (!members) return { tool: 'cargo', workspaces: [] }
  const ws = members[1].match(/["']([^"']+)["']/g)?.map(m => m.replace(/^['"]|['"]$/g, '')) ?? []
  return { tool: 'cargo', workspaces: ws }
}

export const rustScanner: ScannerPlugin = {
  name: 'rust',

  match(root) {
    return fs.existsSync(path.join(root, 'Cargo.toml'))
  },

  detect(root): ScannerPluginResult {
    let cargo: string
    try { cargo = fs.readFileSync(path.join(root, 'Cargo.toml'), 'utf-8') }
    catch { return { languages: ['rust'], packageManagers: ['cargo'] } }

    return {
      languages: ['rust'],
      deps: extractDeps(cargo),
      packageManagers: ['cargo'],
      monorepo: detectWorkspace(cargo),
    }
  },
}
