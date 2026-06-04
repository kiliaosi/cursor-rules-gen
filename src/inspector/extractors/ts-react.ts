import path from 'node:path'
import type { Convention, InspectorExtractor, ProjectConventions, ProjectPattern } from '../../types.js'
import { parseFile, type AstExtract, type ImportInfo } from '../ast/parse.js'
import { sampleFiles, type SamplingResult } from '../sampling.js'

/** Files at the project root or one dir deep that hint at a React project. */
const REACT_MARKERS = [
  /react/i, /@types\/react/i, /next/i, /umi/i, /remix/i, /astro/i, /gatsby/i,
]

const I18N_HOOKS = new Set(['useIntl', 'useTranslation', 'useI18n', 'i18n', 't'])
const REQUEST_DIRECT = new Set(['fetch', 'axios'])
const REQUEST_HELPER_PATTERNS = [/request/i, /http/i, /client/i]

export const tsReactExtractor: InspectorExtractor = {
  name: 'ts-react',

  match(languages: string[]): boolean {
    return languages.includes('typescript') || languages.includes('javascript')
  },

  extract(projectRoot: string, srcDir: string): ProjectConventions {
    const patterns: ProjectPattern[] = []
    const conventions: Convention[] = []

    // 1. Sample representative files
    const sampling = sampleFiles(projectRoot, srcDir, ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'])
    if (sampling.all.length === 0) return { patterns, conventions }

    // 2. Parse each sampled file
    const extracts: AstExtract[] = []
    for (const file of sampling.all) {
      const ext = parseFile(path.join(projectRoot, file))
      if (ext) {
        ext.file = file // store project-relative path for evidence
        extracts.push(ext)
      }
    }

    if (extracts.length === 0) return { patterns, conventions }

    // 3. Extract patterns
    patterns.push(...extractRequestPattern(extracts))
    patterns.push(...extractI18nPattern(extracts))
    patterns.push(...extractExportPattern(extracts))
    patterns.push(...extractComponentPattern(extracts))
    patterns.push(...extractComponentTemplatePattern(extracts, sampling))
    patterns.push(...extractNamingPattern(extracts))

    // 4. Convert high-confidence patterns to conventions
    conventions.push(...patternsToConventions(patterns, extracts))

    return { patterns, conventions }
  },
}

// ---------------------------------------------------------------------------
// Pattern extractors
// ---------------------------------------------------------------------------

/** Detect unified request helper vs direct axios/fetch usage. */
function extractRequestPattern(extracts: AstExtract[]): ProjectPattern[] {
  const requestHelpers = new Map<string, { count: number; files: string[] }>()
  let directCount = 0
  const directFiles: string[] = []

  for (const e of extracts) {
    for (const imp of e.imports) {
      // Check if any imported name looks like a request helper
      for (const name of imp.names) {
        if (REQUEST_HELPER_PATTERNS.some(p => p.test(name))) {
          const key = `${imp.source}:${name}`
          const entry = requestHelpers.get(key) ?? { count: 0, files: [] }
          entry.count++
          entry.files.push(relativeFile(e.file))
          requestHelpers.set(key, entry)
        }
      }
    }
    // Detect direct fetch/axios usage
    for (const call of e.functionCalls) {
      if (REQUEST_DIRECT.has(call.name)) {
        directCount++
        directFiles.push(relativeFile(e.file))
      }
    }
    // Also check for direct axios imports
    for (const imp of e.imports) {
      if (imp.source === 'axios' || imp.source === 'node-fetch') {
        directCount++
        directFiles.push(relativeFile(e.file))
      }
    }
  }

  const results: ProjectPattern[] = []
  if (requestHelpers.size > 0) {
    for (const [key, info] of requestHelpers) {
      results.push({
        type: 'request',
        label: `Unified request helper: \`${key}\``,
        evidence: [...new Set(info.files)],
        detail: `Found ${info.count} import(s) of a request helper across ${info.files.length} file(s).`,
      })
    }
  }
  if (directCount > 0 && requestHelpers.size === 0) {
    results.push({
      type: 'request',
      label: 'Direct use of fetch/axios (no unified helper detected)',
      evidence: [...new Set(directFiles)],
      detail: `Found ${directCount} direct fetch/axios reference(s). Consider creating a unified request utility.`,
    })
  }

  return results
}

/** Detect i18n hook usage, including import source and call pattern. */
function extractI18nPattern(extracts: AstExtract[]): ProjectPattern[] {
  const hookUsage = new Map<string, { count: number; files: string[]; sources: Set<string> }>()

  for (const e of extracts) {
    // Track i18n imports to find the source module
    for (const imp of e.imports) {
      for (const name of imp.names) {
        if (I18N_HOOKS.has(name)) {
          const entry = hookUsage.get(name) ?? { count: 0, files: [], sources: new Set() }
          entry.sources.add(imp.source)
          hookUsage.set(name, entry)
        }
      }
    }
    // Track i18n function calls
    for (const call of e.functionCalls) {
      if (I18N_HOOKS.has(call.callee)) {
        const entry = hookUsage.get(call.callee) ?? { count: 0, files: [], sources: new Set() }
        entry.count++
        entry.files.push(relativeFile(e.file))
        hookUsage.set(call.callee, entry)
      }
    }
  }

  const results: ProjectPattern[] = []
  if (hookUsage.size > 0) {
    const hooks = [...hookUsage.entries()]
      .map(([hook, info]) => {
        const src = info.sources.size > 0 ? ` from ${[...info.sources].join(', ')}` : ''
        return `\`${hook}\`${src} (${info.count}x)`
      })
      .join(', ')
    const allFiles = new Set<string>()
    for (const [, info] of hookUsage) {
      for (const f of info.files) allFiles.add(f)
    }
    results.push({
      type: 'i18n',
      label: `Internationalization via ${hooks}`,
      evidence: [...allFiles],
      detail: 'Use only the detected i18n import source. Do not import i18n functions from other modules or hardcode user-facing strings.',
    })
  }

  return results
}

/** Detect named vs default export conventions. */
function extractExportPattern(extracts: AstExtract[]): ProjectPattern[] {
  let namedCount = 0
  let defaultCount = 0
  const evidence: string[] = []

  for (const e of extracts) {
    if (e.exports.length > 0) evidence.push(relativeFile(e.file))
    for (const exp of e.exports) {
      if (exp.isDefault) defaultCount++
      else namedCount++
    }
  }

  if (namedCount + defaultCount === 0) return []

  const dominant = namedCount > defaultCount ? 'named' : 'default'
  const ratio = dominant === 'named'
    ? `${namedCount} named vs ${defaultCount} default`
    : `${defaultCount} default vs ${namedCount} named`

  return [{
    type: 'exports',
    label: `${dominant === 'named' ? 'Named' : 'Default'} exports dominate (${ratio})`,
    evidence,
    detail: 'Prefer the dominant export style for consistency across new code.',
  }]
}

/** Detect component conventions. */
function extractComponentPattern(extracts: AstExtract[]): ProjectPattern[] {
  let funcCount = 0
  let classCount = 0

  for (const e of extracts) {
    if (e.componentType === 'function') funcCount++
    else if (e.componentType === 'class') classCount++
  }

  if (funcCount + classCount === 0) return []

  return [{
    type: 'components',
    label: funcCount > classCount
      ? `Functional components (${funcCount} detected, ${classCount} class)`
      : `Class components (${classCount} detected, ${funcCount} functional)`,
    evidence: [],
    detail: funcCount > classCount
      ? 'Use functional components with hooks — avoid class components.'
      : 'Class components dominate — be consistent with the existing codebase.',
  }]
}

// ---------------------------------------------------------------------------
// Pattern → Convention
// ---------------------------------------------------------------------------

function patternsToConventions(patterns: ProjectPattern[], extracts: AstExtract[]): Convention[] {
  const conventions: Convention[] = []

  for (const p of patterns) {
    switch (p.type) {
      case 'request': {
        const hasHelper = !p.label.startsWith('Direct')
        conventions.push({
          rule: hasHelper
            ? `Unified request helper detected — use the project's request wrapper instead of raw fetch/axios.`
            : 'No unified request helper found — consider wrapping fetch/axios in a shared utility.',
          evidence: p.evidence,
        })
        break
      }
      case 'i18n':
        conventions.push({
          rule: 'Use the detected i18n hook for all user-facing strings. Do not hardcode text in components.',
          evidence: p.evidence,
        })
        break
      case 'exports':
        conventions.push({
          rule: p.label.includes('Named')
            ? 'Prefer named exports — they are the dominant convention in this project.'
            : 'Prefer default exports — they are the dominant convention in this project.',
          evidence: p.evidence,
        })
        break
      case 'components':
        conventions.push({
          rule: p.label.includes('Functional')
            ? 'Use functional components with hooks — class components are rare in this codebase.'
            : 'Class components are common — match the existing pattern unless refactoring.',
          evidence: p.evidence,
        })
        break
      case 'structure':
        conventions.push({
          rule: 'Place each component in its own directory with an index.ts(x) entry point.',
          evidence: p.evidence,
        })
        break
      case 'naming':
        conventions.push({
          rule: p.label.includes('PascalCase')
            ? 'Use PascalCase for component file names — this is the dominant convention in this project.'
            : p.label.includes('camelCase')
              ? 'Use camelCase for file names — this is the dominant convention in this project.'
              : `Follow the project's dominant file naming style (${p.label}).`,
          evidence: p.evidence,
        })
        break
    }
  }

  return conventions
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeFile(filePath: string): string {
  // Already project-relative from sampling
  return filePath.replace(/\\/g, '/')
}

// ---------------------------------------------------------------------------
// Component template pattern — detect ComponentName/index.tsx structure
// ---------------------------------------------------------------------------

function extractComponentTemplatePattern(extracts: AstExtract[], sampling: SamplingResult): ProjectPattern[] {
  // Check if sampled files follow the ComponentDir/index.tsx pattern
  const dirEntries = new Map<string, number>()
  for (const file of sampling.all) {
    const dir = path.dirname(file)
    const base = path.basename(file)
    if (base === 'index.tsx' || base === 'index.ts') {
      dirEntries.set(dir, (dirEntries.get(dir) ?? 0) + 1)
    }
  }

  if (dirEntries.size >= 2) {
    return [{
      type: 'structure',
      label: `Components in own directories: ${dirEntries.size} dir(s) use index.ts(x) as entry point`,
      evidence: [...dirEntries.keys()],
      detail: 'Each component lives in its own directory with an index.ts(x) entry point. Follow this "directory per component" convention for new components.',
    }]
  }

  return []
}

// ---------------------------------------------------------------------------
// Naming convention pattern — detect file naming style
// ---------------------------------------------------------------------------

function extractNamingPattern(extracts: AstExtract[]): ProjectPattern[] {
  let camelCaseCount = 0
  let kebabCount = 0
  let pascalCount = 0

  for (const e of extracts) {
    const base = path.basename(e.file).replace(/\.\w+$/, '')
    if (base === 'index' || base === 'index') continue
    if (/^[a-z][a-zA-Z0-9]*$/.test(base)) camelCaseCount++
    else if (/^[A-Z][a-zA-Z0-9]*$/.test(base)) pascalCount++
    else if (/-/.test(base)) kebabCount++
  }

  const total = camelCaseCount + pascalCount + kebabCount
  if (total === 0) return []

  const dominant = camelCaseCount > pascalCount
    ? 'camelCase'
    : pascalCount > camelCaseCount ? 'PascalCase' : 'mixed'

  return [{
    type: 'naming',
    label: `File naming: ${dominant} (${camelCaseCount} camelCase, ${pascalCount} PascalCase, ${kebabCount} kebab-case)`,
    evidence: [],
    detail: `Matches the dominant naming convention in this project.`,
  }]
}
