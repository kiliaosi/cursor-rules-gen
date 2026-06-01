import type { Ecosystem, LibCategory, LibKnowledge, RawDep } from '../../types.js'
import type { KnowledgeProvider } from '../types.js'

/** Declarative entry in an ecosystem's knowledge table. */
export interface KnowledgeEntry {
  displayName: string
  category: LibCategory
  variant?: string
  summary?: string
  conventions?: string[]
  constraints?: string[]
  commands?: string[]
}

export type KnowledgeTable = Record<string, KnowledgeEntry>

export interface EcosystemProviderOptions {
  /** When `prefix`, match `dep.name === key || dep.name.startsWith(key + '/')` (Go modules) */
  matcher?: 'exact' | 'prefix'
}

function toKnowledge(name: string, version: string, entry: KnowledgeEntry): LibKnowledge {
  return {
    name,
    displayName: entry.displayName,
    version,
    category: entry.category,
    variant: entry.variant,
    summary: entry.summary ?? '',
    conventions: entry.conventions ?? [],
    constraints: entry.constraints ?? [],
    commands: entry.commands ?? [],
  }
}

/**
 * Build a `KnowledgeProvider` from a declarative ecosystem table.
 * Keeps each ecosystem's knowledge file pure data + this thin adapter.
 */
export function createEcosystemProvider(
  name: string,
  ecosystem: Ecosystem,
  table: KnowledgeTable,
  options: EcosystemProviderOptions = {},
): KnowledgeProvider {
  const matcher = options.matcher ?? 'exact'

  function find(depName: string): KnowledgeEntry | undefined {
    const direct = table[depName]
    if (direct) return direct
    if (matcher !== 'prefix') return undefined
    for (const key of Object.keys(table)) {
      if (depName.startsWith(key + '/')) return table[key]
    }
    return undefined
  }

  return {
    name,
    resolveDep(dep: RawDep) {
      if (dep.ecosystem !== ecosystem) return null
      const entry = find(dep.name)
      return entry ? toKnowledge(dep.name, dep.version, entry) : null
    },
  }
}
