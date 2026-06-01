import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { LibKnowledge, RawDep } from '../types.js'
import type { KnowledgeProvider } from './types.js'
import { depKey } from './types.js'

// ---------------------------------------------------------------------------
// Cache file format
// ---------------------------------------------------------------------------

interface CacheRecord {
  knowledge: LibKnowledge
  cachedAt: number
}

interface CacheFile {
  version: 1
  entries: Record<string, CacheRecord>
}

const CACHE_VERSION = 1
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function defaultCachePath(): string {
  return path.join(os.homedir(), '.cursor-rules-gen', 'cache.json')
}

/** Cache by `ecosystem:name@major` — patch bumps shouldn't invalidate. */
function cacheKey(dep: RawDep): string {
  const major = dep.version.split('.')[0]?.replace(/[^\d]/g, '') || '0'
  return `${depKey(dep)}@${major}`
}

// ---------------------------------------------------------------------------
// Cache store — load once, flush on write
// ---------------------------------------------------------------------------

export class KnowledgeCache {
  private data: CacheFile
  private dirty = false

  constructor(
    private readonly filePath: string = defaultCachePath(),
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {
    this.data = this.load()
  }

  private load(): CacheFile {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as CacheFile
      if (parsed.version === CACHE_VERSION && parsed.entries) return parsed
    } catch { /* missing or corrupt — start fresh */ }
    return { version: CACHE_VERSION, entries: {} }
  }

  get(dep: RawDep): LibKnowledge | null {
    const record = this.data.entries[cacheKey(dep)]
    if (!record) return null
    if (Date.now() - record.cachedAt > this.ttlMs) return null
    // Reflect the actually-detected version, not the cached major bucket.
    return { ...record.knowledge, version: dep.version }
  }

  set(dep: RawDep, knowledge: LibKnowledge): void {
    this.data.entries[cacheKey(dep)] = { knowledge, cachedAt: Date.now() }
    this.dirty = true
  }

  flush(): void {
    if (!this.dirty) return
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    this.dirty = false
  }

  clear(): void {
    this.data = { version: CACHE_VERSION, entries: {} }
    this.dirty = true
  }
}

// ---------------------------------------------------------------------------
// Provider wrappers
// ---------------------------------------------------------------------------

/** Read-side provider: answers from cache, returns null on miss. */
export function cacheReadProvider(cache: KnowledgeCache): KnowledgeProvider {
  return {
    name: 'cache',
    resolveDep(dep) {
      return cache.get(dep)
    },
  }
}

/**
 * Wraps a provider so every successful resolution is written back to the
 * cache. Used to wrap the LLM provider: LLM results get persisted, static
 * results do not (they're already free).
 */
export function withCacheWrite(cache: KnowledgeCache, provider: KnowledgeProvider): KnowledgeProvider {
  return {
    name: `${provider.name}+cache`,

    async resolveDep(dep: RawDep) {
      const result = provider.resolveDep ? await provider.resolveDep(dep) : null
      if (result) cache.set(dep, result)
      return result
    },

    async resolveDeps(deps: RawDep[]) {
      if (!provider.resolveDeps) {
        const out = new Map<string, LibKnowledge>()
        for (const dep of deps) {
          const r = provider.resolveDep ? await provider.resolveDep(dep) : null
          if (r) { cache.set(dep, r); out.set(depKey(dep), r) }
        }
        return out
      }
      const batch = await provider.resolveDeps(deps)
      const byKey = new Map(deps.map(d => [depKey(d), d]))
      for (const [key, lib] of batch) {
        const dep = byKey.get(key)
        if (dep) cache.set(dep, lib)
      }
      return batch
    },

    resolveLanguage: provider.resolveLanguage?.bind(provider),
    resolvePackageManager: provider.resolvePackageManager?.bind(provider),
    resolveMonorepo: provider.resolveMonorepo?.bind(provider),
  }
}

export { defaultCachePath }
