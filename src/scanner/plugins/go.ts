import fs from 'node:fs'
import path from 'node:path'
import type { RawDep, ScannerPlugin, ScannerPluginResult } from '../../types.js'

function extractDeps(gomod: string): RawDep[] {
  const deps: RawDep[] = []
  const seen = new Set<string>()

  const add = (mod: string, ver = '') => {
    if (seen.has(mod)) return
    seen.add(mod)
    deps.push({ name: mod, version: ver.replace(/^v/, ''), ecosystem: 'go' })
  }

  for (const block of gomod.match(/require\s*\(([\s\S]*?)\)/g) ?? []) {
    for (const line of block.split(/\r?\n/)) {
      const m = line.match(/^\s+([\S]+)\s+([\S]+)/)
      if (m && !m[1].startsWith('//')) add(m[1], m[2])
    }
  }
  for (const m of gomod.matchAll(/^require\s+([\S]+)\s+([\S]+)/gm)) add(m[1], m[2])

  return deps
}

export const goScanner: ScannerPlugin = {
  name: 'go',

  match(root) {
    return fs.existsSync(path.join(root, 'go.mod'))
  },

  detect(root): ScannerPluginResult {
    let gomod: string
    try { gomod = fs.readFileSync(path.join(root, 'go.mod'), 'utf-8') }
    catch { return { languages: ['go'], packageManagers: ['go modules'] } }

    return {
      languages: ['go'],
      deps: extractDeps(gomod),
      packageManagers: ['go modules'],
    }
  },
}
