import type { LibCategory, LibKnowledge } from '../types.js'

/** Display ordering and labels for category sections in generators. */
export const CATEGORY_LABELS: Array<[LibCategory, string]> = [
  ['language', 'Languages'],
  ['framework', 'Frameworks'],
  ['ui', 'UI Libraries'],
  ['state', 'State Management'],
  ['styling', 'Styling'],
  ['build', 'Build Tools'],
  ['testing', 'Testing'],
  ['database', 'Databases'],
  ['devtool', 'Dev Tools'],
  ['tooling', 'Workspace Tooling'],
  ['utility', 'Utilities'],
]

/** Group libraries by category, preserving the canonical display order. */
export function groupByCategory(libs: LibKnowledge[]): Array<[string, LibKnowledge[]]> {
  const bucket = new Map<LibCategory, LibKnowledge[]>()
  for (const lib of libs) {
    const list = bucket.get(lib.category) ?? []
    list.push(lib)
    bucket.set(lib.category, list)
  }
  return CATEGORY_LABELS
    .filter(([cat]) => bucket.has(cat))
    .map(([cat, label]) => [label, bucket.get(cat)!])
}

export const LANG_LABEL: Record<string, string> = {
  typescript: 'TypeScript', javascript: 'JavaScript',
  python: 'Python', go: 'Go', rust: 'Rust',
  java: 'Java', kotlin: 'Kotlin', csharp: 'C#',
  dart: 'Dart', ruby: 'Ruby', php: 'PHP', unknown: 'Unknown',
}

// ---------------------------------------------------------------------------
// Frontmatter — required for Cursor to actually load a rule. Without it the
// `.mdc` is treated as a plain doc and globs / alwaysApply are ignored.
// ---------------------------------------------------------------------------

export interface Frontmatter {
  description: string
  globs?: string[]
  alwaysApply: boolean
}

export function renderFrontmatter(fm: Frontmatter): string[] {
  const lines = ['---', `description: ${fm.description}`]
  if (fm.globs && fm.globs.length > 0) {
    lines.push(`globs: ${fm.globs.join(',')}`)
  }
  lines.push(`alwaysApply: ${fm.alwaysApply}`, '---', '')
  return lines
}

/** File-extension globs per language, used to auto-attach style rules. */
const LANG_GLOBS: Record<string, string[]> = {
  typescript: ['**/*.ts', '**/*.tsx'],
  javascript: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
  python: ['**/*.py'],
  go: ['**/*.go'],
  rust: ['**/*.rs'],
  dart: ['**/*.dart'],
  java: ['**/*.java'],
  kotlin: ['**/*.kt'],
  csharp: ['**/*.cs'],
  ruby: ['**/*.rb'],
  php: ['**/*.php'],
}

/** Union of globs for the detected languages (deduped, stable order). */
export function globsForLanguages(languages: string[]): string[] {
  const seen = new Set<string>()
  for (const lang of languages) {
    for (const g of LANG_GLOBS[lang] ?? []) seen.add(g)
  }
  return [...seen]
}
