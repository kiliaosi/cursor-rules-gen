import fs from 'node:fs'
import path from 'node:path'
import { scan } from './scanner/index.js'
import { createResolver, selectTransport, type KnowledgeProvider } from './resolver/index.js'
import type { ChatTransport } from './resolver/llm.js'
import { skillsProvider } from './resolver/skills-provider.js'
import { generateRules } from './generators/index.js'
import { writeManifest } from './manifest.js'
import { inspect } from './inspector/index.js'
import { sampleFiles } from './inspector/sampling.js'
import { enhanceWithLLM } from './inspector/llm.js'
import type { ProjectConventions, ResolveOptions, ResolvedProject, RuleFile, ScanResult } from './types.js'

export interface RunOptions {
  resolve?: ResolveOptions
  extraProviders?: KnowledgeProvider[]
  transport?: ChatTransport | null
  onLlmProgress?: (done: number, total: number) => void
  deep?: boolean
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

  if (options.deep) {
    // Inspect root src dir if it exists, otherwise each sub-project.
    const srcDirs: string[] = []
    if (scanResult.srcDir) {
      srcDirs.push(scanResult.srcDir)
    }
    for (const sp of scanResult.subProjects) {
      // Each sub-project may have its own src/ — use path relative to root
      const spSrc = path.join(sp.path, 'src')
      try {
        const st = fs.statSync(path.join(projectRoot, spSrc))
        if (st.isDirectory()) srcDirs.push(spSrc)
      } catch { /* no src in this sub-project */ }
    }
    // Fallback: if still nothing, try a few common names
    if (srcDirs.length === 0) {
      for (const dir of ['src', 'app', 'lib']) {
        try {
          const st = fs.statSync(path.join(projectRoot, dir))
          if (st.isDirectory()) { srcDirs.push(dir); break }
        } catch { /* try next */ }
      }
    }

    const allConventions: ProjectConventions = { patterns: [], conventions: [] }
    const allSampledFiles: string[] = []

    for (const srcDir of srcDirs) {
      const conv = await inspect(projectRoot, scanResult.languages, srcDir) // AST-only, no LLM

      // Collect patterns + conventions (dedup as before)
      for (const p of conv.patterns) {
        if (!allConventions.patterns.some(ex => ex.type === p.type && ex.label === p.label)) {
          allConventions.patterns.push(p)
        }
      }
      for (const c of conv.conventions) {
        const existing = allConventions.conventions.find(e => e.rule === c.rule)
        if (!existing) {
          allConventions.conventions.push(c)
        } else {
          for (const e of c.evidence) {
            if (!existing.evidence.includes(e)) existing.evidence.push(e)
          }
        }
      }

      // Collect sampled files for potential LLM enhancement
      const sampling = sampleFiles(projectRoot, srcDir, ['**/*.ts', '**/*.tsx'])
      allSampledFiles.push(...sampling.all)
    }

    // Post-process: resolve conflicting export conventions by counting
    const namedConvention = allConventions.conventions.find(c => c.rule.includes('Prefer named exports'))
    const defaultConvention = allConventions.conventions.find(c => c.rule.includes('Prefer default exports'))
    if (namedConvention && defaultConvention) {
      const namedFiles = namedConvention.evidence.length
      const defaultFiles = defaultConvention.evidence.length
      if (namedFiles > defaultFiles) {
        allConventions.conventions = allConventions.conventions.filter(c => c !== defaultConvention)
        namedConvention.rule = `Prefer named exports — dominant convention (${namedFiles} source files vs ${defaultFiles} default-exporting files).`
      } else if (defaultFiles > namedFiles) {
        allConventions.conventions = allConventions.conventions.filter(c => c !== namedConvention)
        defaultConvention.rule = `Prefer default exports — dominant convention (${defaultFiles} source files vs ${namedFiles} named-exporting files).`
      } else {
        allConventions.conventions = allConventions.conventions.filter(c => c !== namedConvention && c !== defaultConvention)
        allConventions.conventions.push({
          rule: 'Mixed export conventions across sub-projects — follow the dominant style of each sub-project.',
          evidence: [...namedConvention.evidence, ...defaultConvention.evidence],
        })
      }
    }

    // LLM enhancement: aggregate all sub-project data into ONE LLM call
    if (transport && allSampledFiles.length > 0) {
      try {
        const enhanced = await enhanceWithLLM(projectRoot, allConventions, allSampledFiles, transport)
        if (enhanced.conventions.length > allConventions.conventions.length) {
          console.warn(`[deep] LLM enhanced: ${allConventions.conventions.length} → ${enhanced.conventions.length} conventions`)
        }
        project.conventions = enhanced
      } catch (err: any) {
        console.warn(`[deep] LLM enhance failed: ${err.message}`)
        project.conventions = allConventions
      }
    } else {
      project.conventions = allConventions
    }
  }

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
