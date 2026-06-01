import path from 'node:path'
import { run, writeManifest, writeSelectedRules } from './pipeline.js'
import { diffRules, type RuleDiff } from './diff.js'
import { newDepsSince, readManifest } from './manifest.js'
import { selectTransport, listCursorModels, isCursorCliAvailable, CursorCliTransport } from './resolver/index.js'
import type { ResolveOptions, ResolvedProject, RuleFile, ScanResult } from './types.js'

// ---------------------------------------------------------------------------
// Color helpers (no deps)
// ---------------------------------------------------------------------------

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR

const c = {
  bold: (s: string) => COLOR ? `\x1b[1m${s}\x1b[22m` : s,
  green: (s: string) => COLOR ? `\x1b[32m${s}\x1b[39m` : s,
  cyan: (s: string) => COLOR ? `\x1b[36m${s}\x1b[39m` : s,
  yellow: (s: string) => COLOR ? `\x1b[33m${s}\x1b[39m` : s,
  dim: (s: string) => COLOR ? `\x1b[2m${s}\x1b[22m` : s,
  red: (s: string) => COLOR ? `\x1b[31m${s}\x1b[39m` : s,
}

// ---------------------------------------------------------------------------
// Argument parsing — minimal, no deps
// ---------------------------------------------------------------------------

interface CliArgs {
  projectRoot: string
  dryRun: boolean
  diff: boolean
  force: boolean
  help: boolean
  listModels: boolean
  resolve: ResolveOptions
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    projectRoot: '.',
    dryRun: false,
    diff: false,
    force: false,
    help: false,
    listModels: false,
    resolve: { mode: 'static' },
  }

  let positional = 0
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]

    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--diff') args.diff = true
    else if (a === '--force' || a === '-f') args.force = true
    else if (a === '--list-models') args.listModels = true
    else if (a === '--llm') args.resolve.mode = 'llm'
    else if (a === '--no-cache') args.resolve.noCache = true
    else if (a === '--api-key') args.resolve.apiKey = next()
    else if (a === '--api-base') args.resolve.apiBase = next()
    else if (a === '--model') args.resolve.model = next()
    else if (!a.startsWith('-') && positional++ === 0) args.projectRoot = a
    else if (a.startsWith('-')) {
      console.error(c.red(`Unknown option: ${a}`))
      process.exit(2)
    }
  }

  args.resolve.apiKey ??= process.env.OPENAI_API_KEY ?? process.env.CURSOR_RULES_GEN_API_KEY
  args.resolve.apiBase ??= process.env.OPENAI_API_BASE
  args.resolve.model ??= process.env.CURSOR_RULES_GEN_MODEL

  return args
}

function printHelp() {
  console.log(`
  ${c.bold('cursor-rules-gen')} — Auto-generate .cursor/rules/ for your project

  ${c.bold('Usage:')}
    npx cursor-rules-gen [project-dir] [options]

  ${c.bold('Options:')}
    --dry-run         Preview generated rules without writing files
    --diff            Show diff against existing rules (no write)
    --force, -f       Overwrite existing rule files
    --llm             Use LLM-powered knowledge resolution
    --model <name>    Model to use (Cursor CLI: 'auto' or a --list-models id)
    --list-models     List Cursor models available via cursor-agent, then exit
    --api-key <key>   API key for an external OpenAI-compatible LLM (or OPENAI_API_KEY)
    --api-base <url>  Override API base URL (OpenAI-compatible)
    --no-cache        Bypass local knowledge cache
    --help, -h        Show this help message

  ${c.bold('LLM modes:')}
    With ${c.cyan('--llm')} and no ${c.cyan('--api-key')}, the local ${c.cyan('cursor-agent')} CLI is used
    automatically (your Cursor subscription models, including ${c.cyan('auto')}).
    Provide ${c.cyan('--api-key')} to use an external OpenAI-compatible endpoint instead.

  ${c.bold('Examples:')}
    npx cursor-rules-gen                  # Scan current directory
    npx cursor-rules-gen ./my-project     # Specific project
    npx cursor-rules-gen --dry-run        # Preview only
    npx cursor-rules-gen --diff           # Compare with existing rules
    npx cursor-rules-gen --llm            # Use Cursor CLI for unknown deps
    npx cursor-rules-gen --llm --model gpt-5.2
    npx cursor-rules-gen --list-models    # Show available Cursor models
`)
}

async function printModels() {
  if (!(await isCursorCliAvailable())) {
    console.error(c.red('\n  cursor-agent not found on PATH. Install Cursor CLI to use Cursor models.\n'))
    process.exit(1)
  }
  const models = await listCursorModels()
  console.log('')
  console.log(c.bold('  Cursor models (via cursor-agent):'))
  console.log('')
  for (const m of models) {
    console.log(`  ${c.dim('•')} ${c.cyan(m.id.padEnd(28))} ${m.label}`)
  }
  console.log('')
  console.log(c.dim('  Use with: npx cursor-rules-gen --llm --model <id>'))
  console.log('')
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printResolved(project: ResolvedProject) {
  const { meta, libs } = project
  console.log('')
  console.log(c.bold('  Resolved:'))
  console.log('')

  const row = (label: string, values: string[]) => {
    if (values.length === 0) return
    console.log(`  ${c.dim('•')} ${c.cyan(label.padEnd(18))} ${values.join(', ')}`)
  }

  row('Languages', meta.languages)
  row('Package Manager', meta.packageManagers)
  if (meta.monorepo) row('Monorepo', [meta.monorepo.tool])
  if (meta.srcDir) row('Source Dir', [`${meta.srcDir}/`])
  if (meta.ci) row('CI/CD', [meta.ci])
  if (meta.containerized) row('Container', ['Docker'])
  row('Libraries', [`${libs.length} known (${libs.filter(l => l.category === 'framework').length} frameworks)`])

  if (meta.subProjects.length > 0) {
    console.log('')
    console.log(c.bold('  Sub-projects:'))
    console.log('')
    for (const sp of meta.subProjects) {
      const fw = sp.frameworks.length > 0 ? ` — ${sp.frameworks.join(', ')}` : ''
      console.log(`  ${c.dim('·')} ${c.cyan(sp.path.padEnd(24))} ${sp.languages.join(', ')}${fw}`)
    }
  }
  console.log('')
}

function previewRules(rules: RuleFile[]) {
  console.log(c.bold('  Preview (--dry-run):'))
  console.log('')
  for (const rule of rules) {
    console.log(c.cyan(`  ── ${rule.filename} ──`))
    console.log(c.dim(`  ${rule.description}`))
    console.log('')
    for (const line of rule.content.split('\n')) {
      console.log(`  ${c.dim('│')} ${line}`)
    }
    console.log('')
  }
}

const STATUS_BADGE: Record<RuleDiff['status'], string> = {
  new: c.green('NEW'),
  changed: c.yellow('CHANGED'),
  unchanged: c.dim('UNCHANGED'),
}

function reportIncremental(scan: ScanResult, projectRoot: string) {
  const manifest = readManifest(projectRoot)
  if (!manifest) return
  const added = newDepsSince(manifest, scan.deps)
  if (added.length === 0) {
    console.log(c.dim(`  No new dependencies since last generation (${manifest.deps.length} tracked).`))
  } else {
    console.log(c.bold(`  ${added.length} new dependencies since last run:`))
    console.log(c.dim(`  ${added.map(d => d.name).join(', ')}`))
  }
  console.log('')
}

function renderDiff(diffs: RuleDiff[]) {
  console.log(c.bold('  Diff against existing rules:'))
  console.log('')
  for (const d of diffs) {
    console.log(`  ${STATUS_BADGE[d.status]} ${c.cyan(`.cursor/rules/${d.rule.filename}`)}`)
    if (d.status !== 'changed') continue
    for (const line of d.hunks) {
      if (line.startsWith('+')) console.log(`    ${c.green(line)}`)
      else if (line.startsWith('-')) console.log(`    ${c.red(line)}`)
      // context lines omitted to keep the diff focused on changes
    }
    console.log('')
  }
  console.log('')
}

function reportWritten(diffs: RuleDiff[], written: string[]) {
  console.log(c.bold('  Result:'))
  console.log('')
  for (const d of diffs) {
    const file = c.cyan(`.cursor/rules/${d.rule.filename}`)
    const dim = c.dim(`.cursor/rules/${d.rule.filename}`)
    if (written.includes(d.rule.filename)) {
      if (d.status === 'new') console.log(`  ${c.green('✓')} Created ${file}`)
      else console.log(`  ${c.yellow('✎')} Updated ${file}`)
    } else if (d.status === 'changed') {
      console.log(`  ${c.yellow('○')} Skipped ${dim} ${c.dim('(differs — use --force)')}`)
    } else {
      console.log(`  ${c.dim('○')} Unchanged ${dim}`)
    }
  }
  console.log('')
  console.log(c.dim('  Tip: Review and customize the generated rules for your project.'))
  console.log('')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { printHelp(); return }
  if (args.listModels) { await printModels(); return }

  const projectRoot = path.resolve(args.projectRoot)
  console.log('')
  console.log(c.bold('  ⚡ cursor-rules-gen'))
  console.log(c.dim(`  Scanning ${projectRoot}`))

  // Resolve the LLM transport up front so we can report which one is used and
  // fall back cleanly when neither Cursor CLI nor an API key is available.
  let transport
  if (args.resolve.mode === 'llm') {
    transport = await selectTransport(args.resolve)
    if (transport instanceof CursorCliTransport) {
      console.log(c.dim(`  Mode: LLM via Cursor CLI (${args.resolve.model ?? 'auto'})`))
    } else if (transport) {
      console.log(c.dim(`  Mode: LLM via API (${args.resolve.model ?? 'default model'})`))
    } else {
      console.log(c.yellow('  Mode: LLM requested but no model available — using static knowledge.'))
      console.log(c.dim('  Tip: install cursor-agent (Cursor CLI) or pass --api-key.'))
      args.resolve.mode = 'static'
    }
  }

  const { scan, project, rules } = await run(projectRoot, { resolve: args.resolve, transport })

  printResolved(project)
  reportIncremental(scan, projectRoot)

  if (args.dryRun) {
    previewRules(rules)
    return
  }

  const diffs = diffRules(projectRoot, rules)

  if (args.diff) {
    renderDiff(diffs)
    return
  }

  // Decide what to write: new files always; changed files only with --force.
  const toWrite = new Set(
    diffs
      .filter(d => d.status === 'new' || (d.status === 'changed' && args.force))
      .map(d => d.rule.filename),
  )

  const changedButSkipped = diffs.filter(d => d.status === 'changed' && !args.force)
  const written = writeSelectedRules(projectRoot, rules, toWrite)
  writeManifest(projectRoot, scan)

  reportWritten(diffs, written)

  if (changedButSkipped.length > 0) {
    console.log(c.yellow(`  ${changedButSkipped.length} file(s) differ from generated output. Re-run with --force to overwrite, or --diff to inspect.`))
    console.log('')
  }
}

main().catch(err => {
  console.error(c.red(`\n  Error: ${err.message}`))
  if (process.env.DEBUG) console.error(err.stack)
  process.exit(1)
})
