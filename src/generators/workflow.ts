import type { LibKnowledge, PackageManager, ResolvedProject, RuleFile, RuleGenerator } from '../types.js'
import { groupByCategory, renderFrontmatter } from './groups.js'

/** Lifecycle hooks that run automatically — not worth listing as commands. */
const HOOK_SCRIPTS = new Set([
  'prepare', 'preinstall', 'postinstall', 'prepublish', 'prepublishOnly',
  'prepack', 'postpack', 'prestart', 'poststart',
])

/**
 * Bare package-manager display names. Their built-in command lists are generic
 * guesses (`pnpm dev`, `pnpm test`, …); when a project defines its own scripts
 * those guesses are misleading, so we drop them in favour of real scripts.
 */
const BARE_PM_NAMES = new Set(['pnpm', 'Yarn', 'npm', 'Bun', 'uv', 'Poetry', 'PDM', 'pip'])

function hasRealScripts(scripts: Record<string, string>): boolean {
  return Object.keys(scripts).some(n => !HOOK_SCRIPTS.has(n))
}

/** The runner prefix for a package manager (e.g. 'pnpm', 'npm run'). */
function runnerFor(pms: PackageManager[]): string {
  const pm = pms.find(p => p !== 'unknown') ?? 'npm'
  return pm === 'npm' ? 'npm run' : `${pm} run`
}

/** Render the project's real package.json scripts as the primary command list. */
function renderProjectScripts(scripts: Record<string, string>, pms: PackageManager[]): string[] {
  const names = Object.keys(scripts).filter(n => !HOOK_SCRIPTS.has(n))
  if (names.length === 0) return []

  const runner = runnerFor(pms)
  const pad = Math.min(Math.max(...names.map(n => n.length)), 20)

  const lines = ['## Project Scripts', '', '```bash']
  for (const name of names) {
    const cmd = `${runner} ${name}`.padEnd(runner.length + 1 + pad)
    lines.push(`${cmd}  # ${scripts[name]}`)
  }
  lines.push('```', '')
  return lines
}

function renderCommandsSection(label: string, group: LibKnowledge[]): string[] {
  const lines: string[] = []
  let hasContent = false
  const buffer: string[] = []

  for (const lib of group) {
    if (lib.commands.length === 0) continue
    hasContent = true
    buffer.push(`### ${lib.displayName}`, '', '```bash', ...lib.commands, '```', '')
  }

  if (!hasContent) return lines
  lines.push(`## ${label}`, '')
  lines.push(...buffer)
  return lines
}

const GIT_CONVENTIONS = [
  '## Git Conventions',
  '',
  '- Use [Conventional Commits](https://www.conventionalcommits.org/).',
  '- Format: `<type>(<scope>): <subject>`',
  '- Types: `feat`, `fix`, `refactor`, `style`, `perf`, `docs`, `test`, `build`, `chore`',
  '- Atomic commits — each commit should be buildable and pass tests.',
  '',
]

export const workflowGenerator: RuleGenerator = {
  name: 'workflow',

  generate(project: ResolvedProject): RuleFile {
    const lines: string[] = []

    // Agent-decided: pulled in when the conversation is about building,
    // testing, running, or committing — not on every prompt.
    lines.push(...renderFrontmatter({
      description: 'Build, run, test, and git workflow commands for this project. Apply when the task involves running commands, testing, or committing.',
      alwaysApply: false,
    }))
    lines.push('# Development Workflow', '')

    // Real package.json scripts come first — these are the source of truth.
    lines.push(...renderProjectScripts(project.meta.scripts, project.meta.packageManagers))

    // Then workspace tooling — monorepo/filter commands. When real scripts
    // exist, drop bare package-manager entries (their generic dev/build/test
    // guesses would contradict the actual scripts above).
    const groups = groupByCategory(project.libs)
    const tooling = groups.find(([l]) => l === 'Workspace Tooling')
    if (tooling) {
      const libs = hasRealScripts(project.meta.scripts)
        ? tooling[1].filter(l => !BARE_PM_NAMES.has(l.displayName))
        : tooling[1]
      lines.push(...renderCommandsSection('Workspace Commands', libs))
    }

    for (const [label, group] of groups) {
      if (label === 'Workspace Tooling' || label === 'Languages') continue
      lines.push(...renderCommandsSection(label, group))
    }

    // Languages last — generic compile/run commands.
    const langs = groups.find(([l]) => l === 'Languages')
    if (langs) lines.push(...renderCommandsSection('Languages', langs[1]))

    lines.push(...GIT_CONVENTIONS)

    return {
      filename: 'dev-workflow.mdc',
      content: lines.join('\n'),
      description: 'Development workflow, commands, and git conventions',
    }
  },
}
