import * as vscode from 'vscode'
import type { ChatTransport } from '../resolver/llm.js'

// NOTE: The `vscode.lm` language-model API only exists in newer @types/vscode
// (1.90+). We target a lower `engines.vscode` for max compatibility and treat
// these APIs dynamically, guarded at runtime. This path is only a fallback —
// the extension prefers the Cursor CLI (`cursor-agent`) for native models.

type AnyLmModel = {
  name?: string
  sendRequest(messages: unknown[], opts: unknown, token: vscode.CancellationToken): Promise<{ text: AsyncIterable<string> }>
}

/**
 * `ChatTransport` backed by the editor's built-in language model API
 * (`vscode.lm`), used only when the Cursor CLI is unavailable.
 */
export class VsCodeLmTransport implements ChatTransport {
  constructor(
    private readonly model: AnyLmModel,
    private readonly token: vscode.CancellationToken,
  ) {}

  async complete(prompt: string): Promise<string> {
    const lm = (vscode as any).LanguageModelChatMessage
    const messages = [lm.User(prompt)]
    const response = await this.model.sendRequest(messages, {}, this.token)

    let text = ''
    for await (const fragment of response.text) {
      text += fragment
    }
    return text
  }
}

/** Pick the best available chat model, or null if `vscode.lm` is unavailable. */
export async function selectChatModel(): Promise<AnyLmModel | null> {
  const lm = (vscode as any).lm
  if (!lm?.selectChatModels) return null

  const preferences = [
    { vendor: 'copilot', family: 'gpt-4o' },
    { vendor: 'copilot' },
    {},
  ]
  for (const selector of preferences) {
    const models = await lm.selectChatModels(selector)
    if (models.length > 0) return models[0] as AnyLmModel
  }
  return null
}
