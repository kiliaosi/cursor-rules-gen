import type { Convention, ProjectConventions, ResolvedProject, RuleFile, RuleGenerator } from '../types.js'
import { renderFrontmatter } from './groups.js'

/** Generic topics already covered by coding-style.mdc — skip ONLY if pure generic (no quantifier). */
const GENERIC_TOPICS = [
  /^Prefer named exports over default/i,
  /^Prefer default exports over named/i,
  /^Use functional components.*class.*rare/i,
  /^Class components are common/i,
  /^Use class components/i,
]

function isGeneric(rule: string): boolean {
  return GENERIC_TOPICS.some(p => p.test(rule.trim()))
}

export const conventionsGenerator: RuleGenerator = {
  name: 'conventions',

  generate(project: ResolvedProject): RuleFile {
    const conventions = project.conventions
    const lines: string[] = []

    lines.push(...renderFrontmatter({
      description: 'Project-specific conventions extracted from source code. Always apply for accurate code generation.',
      alwaysApply: true,
    }))
    lines.push('# Project Conventions', '')

    if (!conventions || conventions.conventions.length === 0) {
      lines.push('No project-specific conventions detected.')
      lines.push('')
      lines.push('Run `cursor-rules-gen --deep` to analyze source code for project-specific patterns.')
      lines.push('')
      return {
        filename: 'project-conventions.mdc',
        content: lines.join('\n'),
        description: 'Project-specific source code conventions',
      }
    }

    lines.push('## Source-Extracted Conventions', '')
    lines.push('These conventions are derived from actual code in this project. Each is backed by evidence.', '')
    lines.push('')

    const filtered = conventions.conventions.filter(c => !isGeneric(c.rule))

    if (filtered.length === 0) {
      lines.push('No project-specific conventions detected.')
      lines.push('')
      lines.push('Run `cursor-rules-gen --deep` to analyze source code for project-specific patterns.')
      lines.push('')
      return {
        filename: 'project-conventions.mdc',
        content: lines.join('\n'),
        description: 'Project-specific source code conventions',
      }
    }

    for (const conv of filtered) {
      lines.push(`- ${conv.rule}`)
      if (conv.evidence.length > 0) {
        const cites = conv.evidence.slice(0, 3).map(f => `\`${f}\``).join(', ')
        lines.push(`  <small>Evidence: ${cites}</small>`)
      }
      lines.push('')
    }

    if (conventions.patterns.length > 0) {
      lines.push('## Detected Patterns', '')
      lines.push('| Category | Pattern | Evidence |')
      lines.push('|----------|---------|----------|')
      for (const pat of conventions.patterns) {
        const evidence = pat.evidence.slice(0, 2).join(', ') || '—'
        lines.push(`| ${pat.type} | ${pat.label} | ${evidence} |`)
      }
      lines.push('')
    }

    return {
      filename: 'project-conventions.mdc',
      content: lines.join('\n'),
      description: 'Project-specific source code conventions',
    }
  },
}
