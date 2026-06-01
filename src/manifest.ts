import fs from 'node:fs'
import path from 'node:path'
import type { RawDep, ScanResult } from './types.js'
import { depKey } from './resolver/types.js'

/**
 * A small manifest persisted next to the generated rules. It records which
 * dependencies were seen at generation time so we can later answer "what's
 * new?" without re-resolving the whole project.
 */
export interface RulesManifest {
  version: 1
  generatedAt: string
  /** Sorted dep keys (`ecosystem:name`) that were scanned. */
  deps: string[]
}

const MANIFEST_VERSION = 1

function manifestPath(projectRoot: string): string {
  return path.join(projectRoot, '.cursor', 'rules', '.manifest.json')
}

export function readManifest(projectRoot: string): RulesManifest | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath(projectRoot), 'utf-8')) as RulesManifest
    return parsed.version === MANIFEST_VERSION ? parsed : null
  } catch {
    return null
  }
}

export function writeManifest(projectRoot: string, scan: ScanResult): void {
  const manifest: RulesManifest = {
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    deps: scan.deps.map(depKey).sort(),
  }
  const file = manifestPath(projectRoot)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), 'utf-8')
}

/** Deps present in the scan but absent from the last manifest. */
export function newDepsSince(manifest: RulesManifest | null, deps: RawDep[]): RawDep[] {
  if (!manifest) return deps
  const known = new Set(manifest.deps)
  return deps.filter(d => !known.has(depKey(d)))
}
