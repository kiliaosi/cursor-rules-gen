import * as vscode from 'vscode'
import { registerCommands } from './commands.js'

export function activate(context: vscode.ExtensionContext): void {
  registerCommands(context)

  // Offer to generate rules when a workspace without .cursor/rules is opened.
  void maybePromptOnOpen(context)
}

export function deactivate(): void {
  /* nothing to clean up */
}

async function maybePromptOnOpen(context: vscode.ExtensionContext): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0]
  if (!folder) return

  const config = vscode.workspace.getConfiguration('cursorRulesGen')
  if (!config.get<boolean>('promptOnOpen', true)) return

  const dismissedKey = `dismissed:${folder.uri.toString()}`
  if (context.workspaceState.get<boolean>(dismissedKey)) return

  const rulesDir = vscode.Uri.joinPath(folder.uri, '.cursor', 'rules')
  try {
    await vscode.workspace.fs.stat(rulesDir)
    return // already has rules
  } catch {
    /* no rules dir — offer to create */
  }

  const choice = await vscode.window.showInformationMessage(
    'No .cursor/rules found. Generate rules from this project\'s tech stack?',
    'Generate', 'Not now', 'Don\'t ask again',
  )

  if (choice === 'Generate') {
    await vscode.commands.executeCommand('cursorRulesGen.generate')
  } else if (choice === 'Don\'t ask again') {
    await context.workspaceState.update(dismissedKey, true)
  }
}
