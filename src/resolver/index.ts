import type {
  Language, LibKnowledge, MonorepoInfo, PackageManager,
  ProjectMeta, RawDep, ResolveOptions, ResolvedProject,
  ScanResult,
} from '../types.js'
import type { KnowledgeProvider } from './types.js'
import { depKey } from './types.js'
import { staticProviders } from './static/index.js'
import { KnowledgeCache, cacheReadProvider, withCacheWrite } from './cache.js'
import { OpenAITransport, llmProvider, type ChatTransport } from './llm.js'
import { CursorCliTransport, isCursorCliAvailable } from './cursor-cli.js'

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Walks a chain of `KnowledgeProvider`s, asking each one for knowledge about
 * deps / language / package manager / monorepo. Uses "first non-null wins"
 * semantics, with optional batched lookups for providers that support them
 * (LLM, cache). Providers earlier in the chain take precedence — typically
 * `[cache, llm, static]` in LLM mode, just `[static]` otherwise.
 */
export class KnowledgeResolver {
  constructor(
    private readonly providers: KnowledgeProvider[],
    private readonly onComplete?: () => void,
  ) {}

  async resolve(scan: ScanResult, projectName: string, projectRoot: string): Promise<ResolvedProject> {
    const libs: LibKnowledge[] = []
    const seenDisplay = new Set<string>()

    const push = (lib: LibKnowledge | null | undefined) => {
      if (lib && !seenDisplay.has(lib.displayName)) {
        seenDisplay.add(lib.displayName)
        libs.push(lib)
      }
    }

    for (const lang of scan.languages) {
      push(await this.resolveLanguage(lang))
    }

    const depResults = await this.resolveDeps(scan.deps)
    for (const dep of scan.deps) {
      push(depResults.get(depKey(dep)))
    }

    for (const pm of scan.packageManagers) {
      push(await this.resolvePackageManager(pm))
    }

    if (scan.monorepo) {
      push(await this.resolveMonorepo(scan.monorepo))
      // Surface secondary build tools (e.g. Nx layered on pnpm) as their own libs.
      for (const tool of scan.monorepo.extraTools ?? []) {
        push(await this.resolveMonorepo({ tool, workspaces: [] }))
      }
    }

    this.onComplete?.()

    return {
      meta: this.buildProjectMeta(scan, projectName, projectRoot, depResults),
      libs,
    }
  }

  // -------------------------------------------------------------------------
  // Dep resolution — batch-aware, falls through providers
  // -------------------------------------------------------------------------

  private async resolveDeps(deps: RawDep[]): Promise<Map<string, LibKnowledge>> {
    const results = new Map<string, LibKnowledge>()
    const remaining = new Map(deps.map(d => [depKey(d), d]))

    for (const provider of this.providers) {
      if (remaining.size === 0) break

      if (provider.resolveDeps) {
        const batch = await provider.resolveDeps(Array.from(remaining.values()))
        for (const [key, lib] of batch) {
          if (remaining.has(key)) {
            results.set(key, lib)
            remaining.delete(key)
          }
        }
      } else if (provider.resolveDep) {
        for (const [key, dep] of Array.from(remaining)) {
          const lib = await provider.resolveDep(dep)
          if (lib) {
            results.set(key, lib)
            remaining.delete(key)
          }
        }
      }
    }
    return results
  }

  private async resolveLanguage(lang: Language): Promise<LibKnowledge | null> {
    for (const provider of this.providers) {
      if (!provider.resolveLanguage) continue
      const r = await provider.resolveLanguage(lang)
      if (r) return r
    }
    return null
  }

  private async resolvePackageManager(pm: PackageManager): Promise<LibKnowledge | null> {
    for (const provider of this.providers) {
      if (!provider.resolvePackageManager) continue
      const r = await provider.resolvePackageManager(pm)
      if (r) return r
    }
    return null
  }

  private async resolveMonorepo(mono: MonorepoInfo): Promise<LibKnowledge | null> {
    for (const provider of this.providers) {
      if (!provider.resolveMonorepo) continue
      const r = await provider.resolveMonorepo(mono)
      if (r) return r
    }
    return null
  }

  // -------------------------------------------------------------------------
  // Project meta — derives sub-project framework labels from resolved libs
  // -------------------------------------------------------------------------

  private buildProjectMeta(
    scan: ScanResult,
    name: string,
    root: string,
    depResults: Map<string, LibKnowledge>,
  ): ProjectMeta {
    return {
      name,
      root,
      languages: scan.languages,
      packageManagers: scan.packageManagers,
      monorepo: scan.monorepo,
      srcDir: scan.srcDir,
      ci: scan.ci,
      containerized: scan.containerized,
      scripts: scan.scripts,
      subProjects: scan.subProjects.map(sp => ({
        name: sp.name,
        path: sp.path,
        languages: sp.languages,
        frameworks: sp.deps
          .map(d => depResults.get(depKey(d)))
          .filter((l): l is LibKnowledge => !!l && l.category === 'framework')
          .map(l => l.variant ? `${l.displayName} (${l.variant})` : l.displayName),
      })),
    }
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export interface CreateResolverDeps {
  /** Providers injected ahead of the chain (e.g. an editor-native provider). */
  extraProviders?: KnowledgeProvider[]
  /** Pre-built chat transport. Bypasses the built-in transport selection. */
  transport?: ChatTransport | null
  /** LLM progress callback: (resolvedDepCount, totalDepCount). */
  onLlmProgress?: (done: number, total: number) => void
}

/**
 * Build a resolver based on the requested mode.
 *   - 'static' — only the bundled static knowledge tables (default)
 *   - 'llm'    — [extra → cache → llm(+cache write) → static]
 *
 * When `mode: 'llm'` and no `transport` is supplied, the transport is selected
 * synchronously from `apiKey` only. To prefer the Cursor CLI (async detection),
 * resolve a transport via {@link selectTransport} and pass it in `deps.transport`.
 */
export function createResolver(
  options: ResolveOptions = { mode: 'static' },
  deps: CreateResolverDeps = {},
): KnowledgeResolver {
  const chain: KnowledgeProvider[] = [...(deps.extraProviders ?? [])]
  let onComplete: (() => void) | undefined

  if (options.mode === 'llm') {
    const transport = deps.transport !== undefined ? deps.transport : buildHttpTransport(options)
    if (transport) {
      // Order: cache (instant) → static (known libs, free/fast) → LLM (only the
      // remaining unknowns). This keeps large projects fast and limits model
      // calls to the long tail instead of every dependency.
      const llm = llmProvider({ transport, onError: warnLlm, onProgress: deps.onLlmProgress })
      const cache = options.noCache ? null : new KnowledgeCache()
      if (cache) {
        chain.push(cacheReadProvider(cache))
        chain.push(...staticProviders)
        chain.push(withCacheWrite(cache, llm))
        onComplete = () => cache.flush()
      } else {
        chain.push(...staticProviders)
        chain.push(llm)
      }
      return new KnowledgeResolver(chain, onComplete)
    }
    if (deps.extraProviders === undefined || deps.extraProviders.length === 0) {
      warnLlm(new Error('LLM mode requested but no model is available; falling back to static knowledge.'))
    }
  }

  // Static-only (default mode, or LLM fallback).
  chain.push(...staticProviders)
  return new KnowledgeResolver(chain, onComplete)
}

/**
 * Select the best available chat transport for LLM mode:
 *   1. Cursor CLI (`cursor-agent`) — uses the user's Cursor subscription, no key
 *   2. OpenAI-compatible HTTP API — when an apiKey is provided
 *   3. none — caller falls back to static knowledge
 *
 * Cursor CLI is preferred unless an explicit apiKey is given (which signals the
 * user wants a specific external provider).
 */
export async function selectTransport(options: ResolveOptions): Promise<ChatTransport | null> {
  if (options.mode !== 'llm') return null

  const wantsCli = options.cursorCli !== false && !options.apiKey
  if (wantsCli && await isCursorCliAvailable()) {
    return new CursorCliTransport({ model: options.model })
  }
  return buildHttpTransport(options)
}

function buildHttpTransport(options: ResolveOptions): ChatTransport | null {
  if (!options.apiKey) return null
  return new OpenAITransport({
    apiKey: options.apiKey,
    apiBase: options.apiBase,
    model: options.model,
  })
}

function warnLlm(err: Error) {
  // eslint-disable-next-line no-console
  console.error(`  [llm] ${err.message}`)
}

export { staticProviders }
export { CursorCliTransport, isCursorCliAvailable, listCursorModels, detectCursorCli } from './cursor-cli.js'
export type { KnowledgeProvider }
