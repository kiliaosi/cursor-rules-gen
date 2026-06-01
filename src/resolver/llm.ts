import type { Ecosystem, LibCategory, LibKnowledge, RawDep } from '../types.js'
import type { KnowledgeProvider } from './types.js'
import { depKey } from './types.js'

// ---------------------------------------------------------------------------
// Chat completion transport — pluggable so the VSCode extension can swap in
// `vscode.lm` instead of an HTTP call (Step 3).
// ---------------------------------------------------------------------------

export interface ChatTransport {
  /** Send a single user prompt, return the raw assistant text. */
  complete(prompt: string): Promise<string>
}

export interface OpenAITransportOptions {
  apiKey: string
  apiBase?: string
  model?: string
}

const VALID_CATEGORIES: LibCategory[] = [
  'language', 'framework', 'ui', 'state', 'testing', 'build',
  'styling', 'database', 'utility', 'devtool', 'tooling',
]

/** OpenAI-compatible chat completions transport over fetch. */
export class OpenAITransport implements ChatTransport {
  private readonly apiKey: string
  private readonly apiBase: string
  private readonly model: string

  constructor(opts: OpenAITransportOptions) {
    this.apiKey = opts.apiKey
    this.apiBase = (opts.apiBase ?? 'https://api.openai.com/v1').replace(/\/$/, '')
    this.model = opts.model ?? 'gpt-4o-mini'
  }

  async complete(prompt: string): Promise<string> {
    const res = await fetch(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a tech-stack analysis expert. Always reply with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 200)}`)
    }

    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM returned empty response')
    return content
  }
}

// ---------------------------------------------------------------------------
// Prompt + parsing
// ---------------------------------------------------------------------------

function buildPrompt(deps: RawDep[]): string {
  const list = deps.map(d => `- ${d.name}@${d.version || 'latest'} (${d.ecosystem})`).join('\n')
  return `Analyze the following software dependencies and return knowledge about each.

Dependencies:
${list}

Return a JSON object with a "libs" array. For each dependency provide:
{
  "name": "<exact dependency name from the list>",
  "displayName": "<human-friendly name>",
  "category": "framework|ui|state|testing|build|styling|database|utility|devtool|tooling",
  "variant": "<optional short sub-type, e.g. 'Web framework', 'AI/ML'>",
  "summary": "<one sentence describing what it is>",
  "conventions": ["<concise best-practice for using it>", "..."],
  "constraints": ["<version or compatibility caveat>", "..."],
  "commands": ["<relevant CLI command>", "..."]
}

Rules:
- Only include dependencies you actually recognize. Omit unknown ones from the array.
- Keep conventions/constraints/commands short and actionable (max 4 each).
- "name" MUST match the input exactly so results can be correlated.
- Respond with JSON only, no markdown fences.`
}

interface LlmLib {
  name?: string
  displayName?: string
  category?: string
  variant?: string
  summary?: string
  conventions?: unknown
  constraints?: unknown
  commands?: unknown
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string').slice(0, 6)
}

function coerceCategory(c: unknown): LibCategory {
  return VALID_CATEGORIES.includes(c as LibCategory) ? (c as LibCategory) : 'utility'
}

function parseResponse(raw: string, byName: Map<string, RawDep>): Map<string, LibKnowledge> {
  const out = new Map<string, LibKnowledge>()

  let parsed: { libs?: LlmLib[] }
  try {
    parsed = JSON.parse(stripFences(raw))
  } catch {
    return out
  }
  if (!Array.isArray(parsed.libs)) return out

  for (const lib of parsed.libs) {
    if (!lib.name || !lib.displayName) continue
    const dep = byName.get(lib.name) ?? byName.get(lib.name.toLowerCase())
    if (!dep) continue

    out.set(depKey(dep), {
      name: dep.name,
      displayName: lib.displayName,
      version: dep.version,
      category: coerceCategory(lib.category),
      variant: typeof lib.variant === 'string' && lib.variant ? lib.variant : undefined,
      summary: typeof lib.summary === 'string' ? lib.summary : '',
      conventions: toStringArray(lib.conventions),
      constraints: toStringArray(lib.constraints),
      commands: toStringArray(lib.commands),
    })
  }
  return out
}

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface LlmProviderOptions {
  transport: ChatTransport
  /** Max deps per request (batched to reduce round-trips). */
  batchSize?: number
  /** How many batches to run in parallel. */
  concurrency?: number
  /** Hard cap on deps sent to the model (bounds worst-case latency/cost). */
  maxDeps?: number
  /** Called on transport errors; defaults to silent (fall through to static). */
  onError?: (err: Error) => void
  /** Progress callback: (resolvedDepCount, totalDepCount). */
  onProgress?: (done: number, total: number) => void
}

// Dependencies that almost never warrant a coding rule — build plumbing, type
// stubs, lint/format plugins, loaders. Skipping these keeps the model focused
// on libraries that actually shape how code is written.
const LOW_VALUE = [
  /^@types\//,
  /-loader$/, /^@.*\/.*-loader$/,
  /^@babel\//, /^babel-/,
  /eslint/, /prettier/, /stylelint/, /^@commitlint\//,
  /postcss/, /^@rsdoctor\//,
  /^@testing-library\/jest-dom$/,
  /^(husky|lint-staged|cross-env|rimraf|npm-run-all|concurrently|opener|shelljs)$/,
]

function isLowValue(name: string): boolean {
  return LOW_VALUE.some(re => re.test(name))
}

/** Run async tasks with a bounded concurrency. */
async function mapLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++
      await worker(items[idx])
    }
  })
  await Promise.all(runners)
}

/**
 * Resolves dependency knowledge via an LLM. Filters low-value deps, caps the
 * total, then runs batches concurrently. On any failure it returns partial
 * results so the resolver chain falls through to the static provider.
 */
export function llmProvider(options: LlmProviderOptions): KnowledgeProvider {
  const batchSize = options.batchSize ?? 10
  const concurrency = options.concurrency ?? 4
  const maxDeps = options.maxDeps ?? 50

  return {
    name: 'llm',

    async resolveDeps(deps: RawDep[]): Promise<Map<string, LibKnowledge>> {
      const results = new Map<string, LibKnowledge>()

      const candidates = deps.filter(d => !isLowValue(d.name)).slice(0, maxDeps)
      if (candidates.length === 0) return results

      const batches: RawDep[][] = []
      for (let i = 0; i < candidates.length; i += batchSize) {
        batches.push(candidates.slice(i, i + batchSize))
      }

      let done = 0
      const total = candidates.length
      options.onProgress?.(0, total)

      await mapLimit(batches, concurrency, async batch => {
        const byName = new Map<string, RawDep>()
        for (const d of batch) {
          byName.set(d.name, d)
          byName.set(d.name.toLowerCase(), d)
        }
        try {
          const raw = await options.transport.complete(buildPrompt(batch))
          for (const [k, v] of parseResponse(raw, byName)) results.set(k, v)
        } catch (err) {
          options.onError?.(err as Error)
          // Swallow — remaining deps fall through to static provider.
        } finally {
          done += batch.length
          options.onProgress?.(done, total)
        }
      })

      return results
    },
  }
}
