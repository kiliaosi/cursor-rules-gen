import fs from 'node:fs'
import path from 'node:path'
import type { RawDep, ScannerPlugin, ScannerPluginResult } from '../../types.js'

function extractDeps(pubspec: string): RawDep[] {
  const deps: RawDep[] = []
  const seen = new Set<string>()

  for (const section of pubspec.matchAll(/(?:dependencies|dev_dependencies):\s*\n((?:\s+.+\n?)*)/g)) {
    for (const line of section[1].split(/\r?\n/)) {
      const m = line.match(/^\s{2}([a-zA-Z0-9_]+)\s*:\s*(.*)/)
      if (!m || m[1].startsWith('#')) continue
      const name = m[1]
      const version = (m[2] ?? '').replace(/^[\^~>=<\s"']+|["'\s]+$/g, '')
      if (seen.has(name)) continue
      seen.add(name)
      deps.push({ name, version, ecosystem: 'dart' })
    }
  }
  return deps
}

export const dartScanner: ScannerPlugin = {
  name: 'dart',

  match(root) {
    return fs.existsSync(path.join(root, 'pubspec.yaml'))
  },

  detect(root): ScannerPluginResult {
    let pubspec: string
    try { pubspec = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf-8') }
    catch { return { languages: ['dart'], packageManagers: ['flutter'] } }

    return {
      languages: ['dart'],
      deps: extractDeps(pubspec),
      packageManagers: ['flutter'],
    }
  },
}
