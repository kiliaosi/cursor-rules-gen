import * as vscode from 'vscode'
import { run, writeManifest, writeSelectedRules } from '../pipeline.js'
import { llmProvider, type ChatTransport } from '../resolver/llm.js'
import { CursorCliTransport, detectCursorCli, isCursorCliAvailable, listCursorModels } from '../resolver/index.js'
import { diffRules, type RuleDiff } from '../diff.js'
import { VsCodeLmTransport, selectChatModel } from './lm-transport.js'
import type { KnowledgeProvider } from '../resolver/index.js'
import type { RuleFile, ScanResult } from '../types.js'

const CONFIG_NS = 'cursorRulesGen'

let output: vscode.OutputChannel | undefined
function log(msg: string): void {
  output ??= vscode.window.createOutputChannel('Cursor Rules Gen')
  output.appendLine(`[${new Date().toLocaleTimeString()}] ${msg}`)
}

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('cursorRulesGen.generate', () => generateRulesCommand(false)),
    vscode.commands.registerCommand('cursorRulesGen.preview', () => generateRulesCommand(true)),
    vscode.commands.registerCommand('cursorRulesGen.selectModel', () => selectModelCommand()),
  )
}

/** Resolved LLM backend for a generation run. */
interface LlmBackend {
  transport?: ChatTransport
  extraProviders?: KnowledgeProvider[]
  label: string
}

async function generateRulesCommand(previewOnly: boolean): Promise<void> {
  const folder = await pickWorkspaceFolder()
  if (!folder) return

  const projectRoot = folder.uri.fsPath

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Generating Cursor rules', cancellable: true },
    async (progress, token) => {
      progress.report({ message: 'Selecting language model…' })
      const backend = await resolveBackend(token)
      log(`Generate "${folder.name}" — backend: ${backend.label}`)

      const useLlm = Boolean(backend.transport || backend.extraProviders?.length)
      progress.report({ message: useLlm ? `Resolving via ${backend.label}…` : 'Scanning project…' })
      const { scan, project, rules } = await run(projectRoot, {
        resolve: { mode: useLlm ? 'llm' : 'static', model: getConfiguredModel() },
        transport: backend.transport,
        extraProviders: backend.extraProviders,
        onLlmProgress: (done, total) => {
          progress.report({ message: `Analyzing dependencies via ${backend.label} — ${done}/${total}` })
          if (done === 0) log(`LLM: analyzing ${total} unknown deps (after static/cache)`)
        },
      })
      log(`Scanned ${scan.deps.length} deps → resolved ${project.libs.length} known libs (${backend.label})`)

      if (token.isCancellationRequested) return

      if (previewOnly) {
        await showPreview(rules)
        return
      }
      await applyWithConfirmation(projectRoot, scan, rules, backend.label)
    },
  )
}

/**
 * Pick the LLM backend, preferring Cursor's own models via `cursor-agent`
 * (uses the user's Cursor subscription, including `auto`). Falls back to a
 * `vscode.lm` model if the CLI is unavailable, then to static knowledge.
 */
async function resolveBackend(token: vscode.CancellationToken): Promise<LlmBackend> {
  const cli = await detectCursorCli(log)
  if (cli) {
    const model = getConfiguredModel()
    return {
      transport: new CursorCliTransport({ model, bin: cli.bin, log }),
      label: `Cursor CLI (${model})`,
    }
  }
  log('cursor-agent not found on PATH/LOCALAPPDATA — trying vscode.lm, else static.')
  try {
    const model = await selectChatModel()
    if (model) {
      const transport = new VsCodeLmTransport(model, token)
      return {
        extraProviders: [llmProvider({ transport, onError: err => log(`[lm] ${err.message}`) })],
        label: `vscode.lm (${model.name ?? 'model'})`,
      }
    }
  } catch {
    // fall through to static
  }
  return { label: 'static knowledge (no model)' }
}

/** Read the configured Cursor model id; defaults to 'auto'. */
function getConfiguredModel(): string {
  return vscode.workspace.getConfiguration(CONFIG_NS).get<string>('model') || 'auto'
}

/** Command: list Cursor models via cursor-agent and persist the chosen one. */
async function selectModelCommand(): Promise<void> {
  if (!(await isCursorCliAvailable())) {
    void vscode.window.showWarningMessage(
      'cursor-agent (Cursor CLI) was not found. Install it to choose a Cursor model.',
    )
    return
  }

  let models
  try {
    models = await listCursorModels()
  } catch (err: any) {
    void vscode.window.showErrorMessage(`Failed to list Cursor models: ${err.message}`)
    return
  }

  const current = getConfiguredModel()
  const items: vscode.QuickPickItem[] = models.map(m => ({
    label: m.id,
    description: m.label,
    picked: m.id === current,
  }))

  const choice = await vscode.window.showQuickPick(items, {
    title: 'Select the Cursor model for rule generation',
    placeHolder: `Current: ${current}`,
  })
  if (!choice) return

  await vscode.workspace
    .getConfiguration(CONFIG_NS)
    .update('model', choice.label, vscode.ConfigurationTarget.Global)
  void vscode.window.showInformationMessage(`Cursor Rules: model set to "${choice.label}".`)
}

async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) {
    void vscode.window.showErrorMessage('Open a folder first to generate Cursor rules.')
    return undefined
  }
  if (folders.length === 1) return folders[0]
  return vscode.window.showWorkspaceFolderPick()
}

async function showPreview(rules: RuleFile[]): Promise<void> {
  const body = rules.map(r => `<!-- ${r.filename}: ${r.description} -->\n\n${r.content}`).join('\n\n---\n\n')
  const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: body })
  await vscode.window.showTextDocument(doc, { preview: true })
}

/**
 * Diff-aware write: new files go in silently; changed files require explicit
 * confirmation (and can be inspected before overwriting). Unchanged files
 * are left untouched.
 */
async function applyWithConfirmation(projectRoot: string, scan: ScanResult, rules: RuleFile[], backendLabel: string): Promise<void> {
  const diffs = diffRules(projectRoot, rules)
  const newFiles = diffs.filter(d => d.status === 'new')
  const changed = diffs.filter(d => d.status === 'changed')

  const toWrite = new Set(newFiles.map(d => d.rule.filename))

  if (changed.length > 0) {
    const choice = await vscode.window.showWarningMessage(
      `${changed.length} existing rule file(s) differ from the generated output.`,
      { modal: false },
      'Review diff', 'Overwrite all', 'Keep existing',
    )
    if (choice === 'Review diff') {
      await showDiff(changed)
      return // let the user decide after reviewing; no write
    }
    if (choice === 'Overwrite all') {
      for (const d of changed) toWrite.add(d.rule.filename)
    }
  }

  const written = writeSelectedRules(projectRoot, rules, toWrite)
  writeManifest(projectRoot, scan)
  log(`Wrote ${written.length} file(s) via ${backendLabel}: ${written.join(', ') || '(none)'}`)

  if (written.length === 0 && changed.length === 0) {
    void vscode.window.showInformationMessage(`Cursor rules already up to date — via ${backendLabel}.`)
  } else {
    void vscode.window.showInformationMessage(
      `Cursor rules: wrote ${written.length} file(s) via ${backendLabel}.`,
      'Show Log',
    ).then(choice => { if (choice === 'Show Log') output?.show() })
  }
}

async function showDiff(changed: RuleDiff[]): Promise<void> {
  const body = changed
    .map(d => `# ${d.rule.filename}\n\n\`\`\`diff\n${d.hunks.join('\n')}\n\`\`\``)
    .join('\n\n')
  const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: body })
  await vscode.window.showTextDocument(doc, { preview: true })
}
