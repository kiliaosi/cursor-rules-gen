import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import type { ChatTransport } from './llm.js'

const execFileAsync = promisify(execFile)

/**
 * Candidate `cursor-agent` launchers, in priority order. PATH lookup works in a
 * normal shell, but a GUI-launched editor's extension host often lacks the
 * install dir on PATH — so we also probe known install locations directly.
 */
export function cursorBinCandidates(preferred?: string): string[] {
  const out: string[] = []
  const add = (p: string | undefined) => { if (p && !out.includes(p)) out.push(p) }

  add(preferred)
  add(process.env.CURSOR_AGENT_BIN)

  if (process.platform === 'win32') {
    const homes = [process.env.LOCALAPPDATA, process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'AppData', 'Local')]
    for (const home of homes) {
      if (!home) continue
      add(path.join(home, 'cursor-agent', 'cursor-agent.cmd'))
    }
  } else {
    const home = process.env.HOME
    if (home) {
      add(path.join(home, '.local', 'bin', 'cursor-agent'))
      add('/usr/local/bin/cursor-agent')
    }
  }
  add('cursor-agent') // last resort: rely on PATH
  return out
}

/** First candidate that exists on disk, or 'cursor-agent' (PATH fallback). */
export function resolveCursorBin(preferred?: string): string {
  for (const bin of cursorBinCandidates(preferred)) {
    if (bin === 'cursor-agent') return bin // can't stat a PATH name; let it through
    if (fs.existsSync(bin)) return bin
  }
  return 'cursor-agent'
}

export interface CursorDetection {
  bin: string
}

/**
 * Probe each candidate with `--version` and return the first that runs. Logs
 * every attempt so failures (missing path, exec error, timeout) are visible.
 */
export async function detectCursorCli(log?: (msg: string) => void): Promise<CursorDetection | null> {
  const candidates = cursorBinCandidates()
  log?.(`Probing cursor-agent. LOCALAPPDATA=${process.env.LOCALAPPDATA ?? '(unset)'}`)
  for (const bin of candidates) {
    const exists = bin === 'cursor-agent' ? '(PATH)' : fs.existsSync(bin) ? 'exists' : 'missing'
    if (exists === 'missing') { log?.(`  · ${bin} — missing, skip`); continue }
    try {
      await runAgent(bin, ['--version'], 20_000)
      log?.(`  ✓ ${bin} — OK`)
      return { bin }
    } catch (err: any) {
      log?.(`  ✗ ${bin} — ${(err?.message ?? err).toString().slice(0, 160)}`)
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Cursor CLI transport
//
// Uses the locally-installed `cursor-agent` binary so rule generation can use
// the user's Cursor subscription models (including `auto`) with no API key.
// This is the only supported way to reach Cursor's own models from outside
// the chat UI — `vscode.lm` exposes Copilot models, not Cursor's.
// ---------------------------------------------------------------------------

export interface CursorCliOptions {
  /** Model id from `cursor-agent --list-models`. Defaults to 'auto'. */
  model?: string
  /** Binary name/path. Defaults to a resolved `cursor-agent`. */
  bin?: string
  /** Per-request timeout in ms. */
  timeoutMs?: number
  /** Optional sink for per-call diagnostics (e.g. an editor output channel). */
  log?: (msg: string) => void
}

interface CursorPrintResult {
  type: string
  is_error?: boolean
  result?: string
}

const DEFAULT_BIN = 'cursor-agent'
const DEFAULT_TIMEOUT = 120_000
const MAX_BUFFER = 10 * 1024 * 1024 // 10 MB

/** Run cursor-agent and return stdout, throwing on failure. */
async function runAgent(bin: string, args: string[], timeoutMs: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync(bin, args, {
      timeout: timeoutMs,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
      // On Windows the launcher is a .ps1/.cmd shim; `shell: true` lets the
      // platform resolve it via PATHEXT instead of failing with ENOENT.
      shell: process.platform === 'win32',
    })
    return stdout
  } catch (err: any) {
    const detail = (err.stderr || err.message || '').toString().slice(0, 300)
    throw new Error(`cursor-agent failed: ${detail}`)
  }
}

export class CursorCliTransport implements ChatTransport {
  private readonly model: string
  private readonly bin: string
  private readonly timeoutMs: number
  private readonly log?: (msg: string) => void

  constructor(options: CursorCliOptions = {}) {
    this.model = options.model || 'auto'
    this.bin = resolveCursorBin(options.bin)
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT
    this.log = options.log
  }

  async complete(prompt: string): Promise<string> {
    this.log?.(`→ cursor-agent --model ${this.model} (prompt ${prompt.length} chars)`)
    const started = Date.now()
    const stdout = await runAgent(
      this.bin,
      ['-p', '--output-format', 'json', '--force', '--model', this.model, prompt],
      this.timeoutMs,
    )
    this.log?.(`← cursor-agent responded in ${Date.now() - started}ms`)

    let parsed: CursorPrintResult
    try {
      parsed = JSON.parse(stdout.trim())
    } catch {
      // Some versions stream multiple JSON lines; take the last parseable one.
      const last = stdout.trim().split(/\r?\n/).reverse().find(l => l.trim().startsWith('{'))
      if (!last) throw new Error('cursor-agent returned unparseable output')
      parsed = JSON.parse(last)
    }

    if (parsed.is_error || typeof parsed.result !== 'string') {
      throw new Error('cursor-agent returned an error result')
    }
    return parsed.result
  }
}

// ---------------------------------------------------------------------------
// Detection + model listing
// ---------------------------------------------------------------------------

/** True if `cursor-agent` is callable on this machine. */
export async function isCursorCliAvailable(bin?: string): Promise<boolean> {
  try {
    await runAgent(resolveCursorBin(bin), ['--version'], 10_000)
    return true
  } catch {
    return false
  }
}

export interface CursorModel {
  id: string
  label: string
}

/** Parse `cursor-agent --list-models` into structured entries. */
export async function listCursorModels(bin?: string): Promise<CursorModel[]> {
  const stdout = await runAgent(resolveCursorBin(bin), ['--list-models'], 15_000)
  const models: CursorModel[] = []
  for (const line of stdout.split(/\r?\n/)) {
    // Lines look like: "gpt-5.2 - GPT-5.2"
    const m = line.match(/^\s*([a-z0-9][\w.-]*)\s+-\s+(.+?)\s*$/i)
    if (m) models.push({ id: m[1], label: m[2] })
  }
  return models
}
