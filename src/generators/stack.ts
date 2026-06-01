import type { LibKnowledge, ResolvedProject, RuleFile, RuleGenerator } from '../types.js'
import { LANG_LABEL, groupByCategory, renderFrontmatter } from './groups.js'

function libBullet(lib: LibKnowledge): string {
  const v = lib.version ? ` ${lib.version}` : ''
  const label = lib.variant ? `${lib.displayName} (${lib.variant})` : lib.displayName
  return `- **${label}**${v}`
}

function renderConstraints(libs: LibKnowledge[]): string[] {
  const lines: string[] = []
  for (const lib of libs) {
    if (lib.constraints.length === 0) continue
    lines.push(`- **${lib.displayName}**:`)
    for (const c of lib.constraints) lines.push(`  - ${c}`)
  }
  return lines
}

export const stackGenerator: RuleGenerator = {
  name: 'stack',

  generate(project: ResolvedProject): RuleFile {
    const { meta, libs } = project
    const lines: string[] = []

    lines.push(...renderFrontmatter({
      description: `${meta.name} tech stack, versions, and compatibility constraints.`,
      alwaysApply: true,
    }))
    lines.push(`# ${meta.name} — Tech Stack`, '')

    // --- Project facts (top-level meta) ---
    lines.push('## Project')
    lines.push('')
    if (meta.languages.length > 0) {
      lines.push(`- **Language**: ${meta.languages.map(l => LANG_LABEL[l] ?? l).join(', ')}`)
    }
    if (meta.packageManagers.length > 0) {
      lines.push(`- **Package Manager**: ${meta.packageManagers.join(', ')}`)
    }
    if (meta.monorepo) {
      const ws = meta.monorepo.workspaces.length > 0
        ? ` (${meta.monorepo.workspaces.length} packages)`
        : ''
      const extra = meta.monorepo.extraTools?.length
        ? ` + ${meta.monorepo.extraTools.join(', ')}`
        : ''
      lines.push(`- **Monorepo**: ${meta.monorepo.tool}${extra}${ws}`)
    }
    if (meta.srcDir) lines.push(`- **Source Directory**: \`${meta.srcDir}/\``)
    if (meta.ci) lines.push(`- **CI/CD**: ${meta.ci}`)
    if (meta.containerized) lines.push('- **Containerized**: Docker')
    lines.push('')

    // --- Library inventory grouped by category ---
    // Skip 'language' here — already rendered as project meta above.
    for (const [label, group] of groupByCategory(libs)) {
      if (label === 'Languages') continue
      lines.push(`## ${label}`, '')
      for (const lib of group) lines.push(libBullet(lib))
      lines.push('')
    }

    // --- Aggregated constraints ---
    const constraints = renderConstraints(libs)
    if (constraints.length > 0) {
      lines.push('## Constraints', '')
      lines.push(...constraints)
      lines.push('')
    }

    // --- Sub-projects ---
    if (meta.subProjects.length > 0) {
      lines.push('## Sub-projects', '')
      lines.push('| Directory | Language | Frameworks |')
      lines.push('|-----------|----------|------------|')
      for (const sp of meta.subProjects) {
        const lang = sp.languages.map(l => LANG_LABEL[l] ?? l).join(', ')
        const fw = sp.frameworks.length > 0 ? sp.frameworks.join(', ') : '—'
        lines.push(`| \`${sp.path}/\` | ${lang} | ${fw} |`)
      }
      lines.push('')
    }

    return {
      filename: 'tech-stack.mdc',
      content: lines.join('\n'),
      description: 'Tech stack overview and version constraints',
    }
  },
}
