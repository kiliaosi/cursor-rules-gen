import type { Language, LibKnowledge, MonorepoInfo, PackageManager, RawDep } from '../types.js'

export type MaybePromise<T> = T | Promise<T>

/**
 * A `KnowledgeProvider` produces `LibKnowledge` for the things scanned out
 * of a project. Each provider answers only what it knows about — the
 * resolver merges results across providers using "first non-null wins".
 *
 * Implementations:
 *   - static/*  — declarative knowledge tables (no network)
 *   - cache     — local JSON cache lookup
 *   - llm       — calls an LLM with structured output (added in Step 2)
 */
export interface KnowledgeProvider {
  name: string

  /** Resolve a single dependency. Return null if this provider has no opinion. */
  resolveDep?(dep: RawDep): MaybePromise<LibKnowledge | null>

  /** Optional batched form — providers that prefer batching (LLM, cache) override this. */
  resolveDeps?(deps: RawDep[]): MaybePromise<Map<string, LibKnowledge>>

  resolveLanguage?(lang: Language): MaybePromise<LibKnowledge | null>
  resolvePackageManager?(pm: PackageManager): MaybePromise<LibKnowledge | null>
  resolveMonorepo?(mono: MonorepoInfo): MaybePromise<LibKnowledge | null>
}

/** Build a unique key for a dep across ecosystems. */
export function depKey(dep: RawDep): string {
  return `${dep.ecosystem}:${dep.name}`
}
