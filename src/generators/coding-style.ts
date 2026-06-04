import type { LibKnowledge, ResolvedProject, RuleFile, RuleGenerator } from '../types.js'
import { LANG_LABEL, globsForLanguages, groupByCategory, renderFrontmatter } from './groups.js'

function renderConventionsSection(label: string, group: LibKnowledge[]): string[] {
  const lines: string[] = []
  let hasContent = false
  const buffer: string[] = []

  for (const lib of group) {
    if (lib.conventions.length === 0) continue
    hasContent = true
    buffer.push(`### ${lib.displayName}`, '')
    for (const c of lib.conventions) buffer.push(`- ${c}`)
    buffer.push('')
  }

  if (!hasContent) return lines
  lines.push(`## ${label}`, '')
  lines.push(...buffer)
  return lines
}

function universalGeneralRules(project: ResolvedProject): string[] {
  const { meta } = project
  const lines: string[] = ['## General', '']

  const hasJS = meta.languages.includes('typescript') || meta.languages.includes('javascript')
  if (hasJS) lines.push('- Prefer named exports over default exports (easier to refactor and search).')
  lines.push('- Keep files under 300 lines. Split large files into logical modules.')
  lines.push('- Comments should explain **why**, not **what**. Avoid obvious narration.')

  const nodePMs = meta.packageManagers.filter(p => (['npm', 'yarn', 'pnpm', 'bun'] as const).includes(p as any))
  if (nodePMs.length === 1) {
    lines.push(`- Use \`${nodePMs[0]}\` as the package manager. Do not mix lock files.`)
  } else if (nodePMs.length > 1) {
    lines.push(`- JS package managers in use: ${nodePMs.map(p => `\`${p}\``).join(', ')}.`)
  }

  lines.push('')
  return lines
}

export const codingStyleGenerator: RuleGenerator = {
  name: 'coding-style',

  generate(project: ResolvedProject): RuleFile {
    const lines: string[] = []

    const globs = globsForLanguages(project.meta.languages)
    const langNames = project.meta.languages.map(l => LANG_LABEL[l] ?? l).join(', ')
    lines.push(...renderFrontmatter({
      description: `Coding conventions${langNames ? ` for ${langNames}` : ''}.`,
      // Auto-attach to source files when we know the languages; otherwise
      // always apply so the conventions are never silently dropped.
      globs: globs.length > 0 ? globs : undefined,
      alwaysApply: globs.length === 0,
    }))
    lines.push('# Coding Style & Conventions', '')

    // --- Project-specific rules from config facts ---
    const configRules: string[] = []
    const ec = project.meta.config
    if (ec.packageType === 'module') {
      configRules.push('- **ESM imports require `.js` extensions** — use `import { foo } from "./bar.js"` even for `.ts` files.')
    }
    if (ec.tsStrict) {
      configRules.push('- **TypeScript strict mode is enabled** — avoid `any`; prefer `unknown` for truly unknown types.')
    }
    if (ec.tsModuleResolution === 'bundler') {
      configRules.push('- **moduleResolution is `bundler`** — no `.js` extensions needed in imports (handled by tsup/rsbuild).')
      // Override the ESM rule above — bundler mode does NOT need .js extensions
      const esmIdx = configRules.findIndex(r => r.includes('.js` extensions'))
      if (esmIdx >= 0) configRules.splice(esmIdx, 1)
    }
    if (ec.tsconfigPaths && Object.keys(ec.tsconfigPaths).length > 0) {
      const aliases = Object.keys(ec.tsconfigPaths).join(', ')
      configRules.push(`- **Path aliases in use**: ${aliases} — use these aliases instead of relative imports across modules.`)
    }
    if (ec.isVscodeExtension && ec.hasVscodeignore) {
      configRules.push('- **Extension project** — published files are controlled by `.vscodeignore`. Do not add new files to the `.vsix` without verifying they are not excluded.')
    }
    if (ec.tsupConfig.exists && ec.tsupConfig.entries.length > 1) {
      configRules.push(`- **Multi-entry build (tsup)**: this project produces ${ec.tsupConfig.entries.length} outputs (${ec.tsupConfig.entries.join(', ')}). New entry modules must be registered in \`tsup.config.ts\`.`)
    }
    if (configRules.length > 0) {
      lines.push('## Project-Specific Constraints', '')
      lines.push(...configRules)
      lines.push('')
    }

    for (const [label, group] of groupByCategory(project.libs)) {
      lines.push(...renderConventionsSection(label, group))
    }

    lines.push(...universalGeneralRules(project))

    return {
      filename: 'coding-style.mdc',
      content: lines.join('\n'),
      description: 'Coding style conventions and best practices',
    }
  },
}
