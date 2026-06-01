import fs from 'node:fs'
import path from 'node:path'
import type { RuleFile } from './types.js'

export type FileStatus = 'new' | 'unchanged' | 'changed'

export interface RuleDiff {
  rule: RuleFile
  status: FileStatus
  /** Existing on-disk content, or null when status is 'new'. */
  current: string | null
  /** Unified-style hunk lines (only for 'changed'). */
  hunks: string[]
}

function rulesDir(projectRoot: string): string {
  return path.join(projectRoot, '.cursor', 'rules')
}

function readExisting(projectRoot: string, filename: string): string | null {
  try {
    return fs.readFileSync(path.join(rulesDir(projectRoot), filename), 'utf-8')
  } catch {
    return null
  }
}

/** Normalize trailing whitespace / line endings so cosmetic diffs are ignored. */
function normalize(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd()
}

/**
 * Minimal line-level diff (LCS-based). Good enough for human-readable
 * previews of generated `.mdc` files — we don't need a full Myers diff.
 */
function lineDiff(oldText: string, newText: string): string[] {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  const n = a.length
  const m = b.length

  // LCS length table
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const out: string[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push(`  ${a[i]}`); i++; j++ }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push(`- ${a[i]}`); i++ }
    else { out.push(`+ ${b[j]}`); j++ }
  }
  while (i < n) out.push(`- ${a[i++]}`)
  while (j < m) out.push(`+ ${b[j++]}`)
  return out
}

/** Compare freshly generated rules against what's on disk. */
export function diffRules(projectRoot: string, rules: RuleFile[]): RuleDiff[] {
  return rules.map(rule => {
    const current = readExisting(projectRoot, rule.filename)
    if (current === null) {
      return { rule, status: 'new', current: null, hunks: [] }
    }
    if (normalize(current) === normalize(rule.content)) {
      return { rule, status: 'unchanged', current, hunks: [] }
    }
    return {
      rule,
      status: 'changed',
      current,
      hunks: lineDiff(normalize(current), normalize(rule.content)),
    }
  })
}
