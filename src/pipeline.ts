import fs from 'node:fs'
import path from 'node:path'
import { scan } from './scanner/index.js'
import { createResolver, selectTransport, type KnowledgeProvider } from './resolver/index.js'
import type { ChatTransport } from './resolver/llm.js'
import { skillsProvider } from './resolver/skills-provider.js'
import { generateRules } from './generators/index.js'
import { writeManifest } from './manifest.js'
import type { ResolveOptions, ResolvedProject, RuleFile, ScanResult } from './types.js'

export interface RunOptions {
  resolve?: ResolveOptions
  /** Providers prepended to the resolver chain (e.g. vscode.lm). */
  extraProviders?: KnowledgeProvider[]
  /** Pre-built transport. If omitted in LLM mode, one is auto-selected. */
  transport?: ChatTransport | null
  /** LLM progress callback: (resolvedDepCount, totalDepCount). */
  onLlmProgress?: (done: number, total: number) => void
}

export interface RunResult {
  scan: ScanResult
  project: ResolvedProject
  rules: RuleFile[]
}

/** Read the project name from package.json, falling back to the dir name. */
export function readProjectName(root: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
    return pkg.name ?? path.basename(root)
  } catch {
    return path.basename(root)
  }
}

/** Scan → resolve → generate. The single entry point shared by CLI + extension. */
export async function run(projectRoot: string, options: RunOptions = {}): Promise<RunResult> {
  const resolveOptions = options.resolve ?? { mode: 'static' }
  const scanResult = scan(projectRoot)

  // Discover Agent Skill files (SKILL.md) from installed node_modules.
  // Always placed at the front of the chain — library maintainers' own
  // knowledge takes priority over static tables, cache, and LLM.
  const skillProv = skillsProvider(projectRoot)
  const extraProviders = options.extraProviders
    ? [skillProv, ...options.extraProviders]
    : [skillProv]

  // In LLM mode, auto-select a transport (Cursor CLI → HTTP) unless caller
  // supplied one or injected its own providers.
  let transport = options.transport
  if (transport === undefined && options.extraProviders === undefined) {
    transport = await selectTransport(resolveOptions)
  }

  const resolver = createResolver(resolveOptions, {
    extraProviders,
    transport,
    onLlmProgress: options.onLlmProgress,
    callerProvidedExtra: options.extraProviders !== undefined,
  })
  const project = await resolver.resolve(scanResult, readProjectName(projectRoot), projectRoot)
  const rules = generateRules(project)
  return { scan: scanResult, project, rules }
}

export interface WriteResult {
  written: string[]
  skipped: string[]
}

/** Write rule files to `<root>/.cursor/rules/`, skipping existing files. */
export function writeRuleFiles(projectRoot: string, rules: RuleFile[], overwrite = false): WriteResult {
  const rulesDir = path.join(projectRoot, '.cursor', 'rules')
  fs.mkdirSync(rulesDir, { recursive: true })

  const written: string[] = []
  const skipped: string[] = []

  for (const rule of rules) {
    const filePath = path.join(rulesDir, rule.filename)
    if (!overwrite && fs.existsSync(filePath)) {
      skipped.push(rule.filename)
      continue
    }
    fs.writeFileSync(filePath, rule.content, 'utf-8')
    written.push(rule.filename)
  }
  return { written, skipped }
}

/** Write specific rule files by filename (used after diff confirmation). */
export function writeSelectedRules(projectRoot: string, rules: RuleFile[], filenames: Set<string>): string[] {
  const rulesDir = path.join(projectRoot, '.cursor', 'rules')
  fs.mkdirSync(rulesDir, { recursive: true })

  const written: string[] = []
  for (const rule of rules) {
    if (!filenames.has(rule.filename)) continue
    fs.writeFileSync(path.join(rulesDir, rule.filename), rule.content, 'utf-8')
    written.push(rule.filename)
  }
  return written
}

export { writeManifest }
