import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { diffRules } from './diff.js'
import type { RuleFile } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_ROOT = path.join(__dirname, '__fixtures_diff')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'test-project')
const RULES_DIR = path.join(PROJECT_ROOT, '.cursor', 'rules')

function writeExisting(filename: string, content: string) {
  if (!fs.existsSync(RULES_DIR)) fs.mkdirSync(RULES_DIR, { recursive: true })
  fs.writeFileSync(path.join(RULES_DIR, filename), content, 'utf-8')
}

beforeAll(() => {
  fs.mkdirSync(RULES_DIR, { recursive: true })
})

afterAll(() => {
  fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true })
})

function rule(name: string, content: string): RuleFile {
  return { filename: name, content, description: '' }
}

describe('diffRules', () => {
  it('detects new files', () => {
    const diffs = diffRules(PROJECT_ROOT, [rule('new-file.mdc', 'hello world')])
    expect(diffs[0].status).toBe('new')
    expect(diffs[0].current).toBeNull()
  })

  it('detects unchanged files', () => {
    writeExisting('same.mdc', 'identical content')
    const diffs = diffRules(PROJECT_ROOT, [rule('same.mdc', 'identical content')])
    expect(diffs[0].status).toBe('unchanged')
  })

  it('detects changed files with hunk output', () => {
    writeExisting('changed.mdc', 'old line')
    const diffs = diffRules(PROJECT_ROOT, [rule('changed.mdc', 'new line')])
    expect(diffs[0].status).toBe('changed')
    expect(diffs[0].hunks.some((h: string) => h.startsWith('-'))).toBe(true)
    expect(diffs[0].hunks.some((h: string) => h.startsWith('+'))).toBe(true)
  })

  it('ignores trailing whitespace differences', () => {
    writeExisting('whitespace.mdc', 'hello\n')
    const diffs = diffRules(PROJECT_ROOT, [rule('whitespace.mdc', 'hello   \n')])
    expect(diffs[0].status).toBe('unchanged')
  })

  it('ignores line-ending differences (CRLF vs LF)', () => {
    writeExisting('crlf.mdc', 'line1\r\nline2')
    const diffs = diffRules(PROJECT_ROOT, [rule('crlf.mdc', 'line1\nline2')])
    expect(diffs[0].status).toBe('unchanged')
  })

  it('reports line-level additions', () => {
    writeExisting('add-line.mdc', 'line1\nline2')
    const diffs = diffRules(PROJECT_ROOT, [rule('add-line.mdc', 'line1\nline2\nline3')])
    expect(diffs[0].status).toBe('changed')
    expect(diffs[0].hunks.filter((h: string) => h.startsWith('+')).length).toBe(1)
  })

  it('reports line-level deletions', () => {
    writeExisting('del-line.mdc', 'line1\nline2\nline3')
    const diffs = diffRules(PROJECT_ROOT, [rule('del-line.mdc', 'line1\nline2')])
    expect(diffs[0].status).toBe('changed')
    expect(diffs[0].hunks.filter((h: string) => h.startsWith('-')).length).toBe(1)
  })

  it('handles empty content', () => {
    writeExisting('empty-check.mdc', 'content')
    const diffs = diffRules(PROJECT_ROOT, [rule('empty-check.mdc', '')])
    expect(diffs[0].status).toBe('changed')
  })
})
