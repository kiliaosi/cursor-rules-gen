import fs from 'node:fs'
import path from 'node:path'
import type { Convention, ProjectConventions } from '../types.js'
import type { ChatTransport } from '../resolver/llm.js'

// ---------------------------------------------------------------------------
// LLM grounded enhancement — takes AST facts + code snippets → richer conventions
// ---------------------------------------------------------------------------

/** Max bytes of source code to send to the LLM (token budget guard). */
const MAX_SOURCE_BYTES = 6_000

/** Timeout for LLM completion. */
const LLM_TIMEOUT_MS = 90_000

/**
 * Use an LLM to produce richer, evidence-backed conventions from AST facts
 * and real code snippets. Keeps only conventions that cite valid `file:line`
 * references from the provided files.
 */
export async function enhanceWithLLM(
  projectRoot: string,
  conventions: ProjectConventions,
  sampledFiles: string[],
  transport: ChatTransport,
): Promise<ProjectConventions> {
  if (sampledFiles.length === 0) return conventions

  // 1. Read code snippets from sampled files (capped)
  const snippets = readSnippets(projectRoot, sampledFiles)

  // 2. Build prompt
  const prompt = buildPrompt(conventions, snippets, sampledFiles)

  // 3. Call LLM with timeout
  let response: string
  try {
    response = await Promise.race([
      transport.complete(prompt),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), LLM_TIMEOUT_MS),
      ),
    ])
  } catch {
    return conventions // LLM unavailable or timeout — keep AST-only conventions
  }

  // 4. Parse conventions from response
  const llmConventions = parseConventions(response, sampledFiles)

  if (llmConventions.length === 0) return conventions

  // 5. Merge: LLM conventions replace their AST-derived equivalents
  return {
    patterns: conventions.patterns,
    conventions: mergeConventions(conventions.conventions, llmConventions),
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildPrompt(
  conventions: ProjectConventions,
  snippets: { file: string; lines: number; code: string }[],
  _files: string[],
): string {
  const facts = conventions.patterns.map((p: { type: string; label: string; evidence: string[]; detail?: string }) => {
    const evidence = p.evidence.length > 0 ? ` (evidence: ${p.evidence.slice(0, 3).join(', ')})` : ''
    const detail = p.detail ? ` — ${p.detail}` : ''
    return `- ${p.type}: ${p.label}${detail}${evidence}`
  }).join('\n')

  const codeSection = snippets.map(s =>
    `### ${s.file} (${s.lines} lines)\n\`\`\`typescript\n${s.code}\n\`\`\``
  ).join('\n\n')

  return `You are analyzing a TypeScript/React project to extract project-specific coding conventions.

## Detected Facts (AST analysis)
${facts || '(none detected)'}

## Sampled Source Code
${codeSection}

## Task
Based on the facts and code samples above, identify project-specific conventions that would help an AI assistant generate code consistent with this project.

Each convention MUST:
1. Cite specific evidence — use format \`file:line\` (e.g., \`components/src/Action/index.tsx:1\`)
2. Be specific to THIS project's actual code patterns
3. NOT repeat generic best practices that aren't supported by the code shown

Good examples:
- "Import useIntl from '../intl' instead of using formatMessage from react-intl directly" (if the code shows this pattern)
- "Component files are placed in their own directory with an index.tsx entry point" (if the directory structure shows this)
- "Utility functions are default-exported from utils/src/" (if exports show this pattern)

Respond with a JSON array ONLY:
\`\`\`json
[{"rule": "convention text", "evidence": ["file:line", ...]}]
\`\`\``
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseConventions(text: string, files: string[]): Convention[] {
  // Extract JSON from markdown code fences
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = jsonMatch ? jsonMatch[1] : text

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const validFiles = new Set(files.map(f => f.replace(/\\/g, '/')))

    return parsed
      .filter((c: any) => typeof c.rule === 'string' && c.rule.length > 3)
      .map((c: any) => ({
        rule: c.rule as string,
        evidence: Array.isArray(c.evidence)
          ? (c.evidence as string[]).filter(e => typeof e === 'string')
          : [],
      }))
      .filter(c => c.evidence.length > 0)
      // Keep only conventions that cite at least one file from our sampled set
      .filter(c => {
        const citedFiles = c.evidence.map(e => e.replace(/:\d+$/, ''))
        return citedFiles.some(f => validFiles.has(f))
      })
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Snippet reading
// ---------------------------------------------------------------------------

function readSnippets(projectRoot: string, files: string[]): { file: string; lines: number; code: string }[] {
  const result: { file: string; lines: number; code: string }[] = []
  let totalBytes = 0

  for (const file of files) {
    if (totalBytes >= MAX_SOURCE_BYTES) break
    const filePath = path.join(projectRoot, file)
    let code: string
    try {
      code = fs.readFileSync(filePath, 'utf-8')
    } catch { continue }

    const size = Buffer.byteLength(code, 'utf-8')
    if (totalBytes + size > MAX_SOURCE_BYTES) {
      // Truncate to fit within budget
      const available = MAX_SOURCE_BYTES - totalBytes
      code = code.slice(0, available) + '\n// ... truncated'
    }
    totalBytes += Math.min(size, MAX_SOURCE_BYTES - totalBytes)

    result.push({
      file: file.replace(/\\/g, '/'),
      lines: code.split('\n').length,
      code,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// Convention merging
// ---------------------------------------------------------------------------

/**
 * Merge LLM-produced conventions with AST-derived ones.
 * LLM conventions take priority when they cover the same topic (by rule
 * similarity), but AST conventions are kept if the LLM didn't address them.
 */
function mergeConventions(astConventions: Convention[], llmConventions: Convention[]): Convention[] {
  const result = [...llmConventions]

  for (const ast of astConventions) {
    // Keep AST convention if no LLM convention covers a similar topic
    const similar = result.some(llm =>
      topicOverlap(ast.rule, llm.rule)
    )
    if (!similar) result.push(ast)
  }

  return result
}

/** Crude topic overlap: check if two rules share significant words. */
function topicOverlap(a: string, b: string): boolean {
  const words = (s: string) => new Set(
    s.toLowerCase().replace(/[^a-z]/g, ' ').split(/\s+/).filter(w => w.length > 3),
  )
  const aWords = words(a)
  const bWords = words(b)
  if (aWords.size === 0 || bWords.size === 0) return false
  let overlap = 0
  for (const w of aWords) {
    if (bWords.has(w)) overlap++
  }
  return overlap >= 2
}
