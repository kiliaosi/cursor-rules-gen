import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sampleFiles } from './sampling.js'

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__')
const PROJ = path.join(FIXTURES, 'sample-project')
const SRC = path.join(PROJ, 'src')

beforeAll(() => {
  fs.mkdirSync(FIXTURES, { recursive: true })

  const dirs = ['pages', 'components', 'hooks', 'services', 'utils', '__tests__']
  for (const d of dirs) fs.mkdirSync(path.join(SRC, d), { recursive: true })

  write('pages/HomePage.tsx', 'export default function HomePage() { return <div/> }')
  write('pages/AboutPage.tsx', 'export const AboutPage = () => <div/>')
  write('components/Button.tsx', 'export function Button() { return <button/> }')
  write('components/Header.tsx', 'export default () => <header/>')
  write('hooks/useAuth.ts', 'export function useAuth() {}')
  write('hooks/useFetch.ts', 'export const useFetch = () => {}')
  write('services/api.ts', 'export const request = {}')
  write('services/auth.ts', 'export function login() {}')
  write('utils/format.ts', 'export function format() {}')
  write('__tests__/helper.test.ts', 'export function testHelper() {}')
})

afterAll(() => {
  fs.rmSync(FIXTURES, { recursive: true, force: true })
})

function write(relativePath: string, content: string) {
  fs.writeFileSync(path.join(SRC, relativePath), content, 'utf-8')
}

describe('sampleFiles', () => {
  it('returns files grouped by bucket', () => {
    const r = sampleFiles(PROJ, 'src', ['**/*.ts', '**/*.tsx'])
    expect(r.buckets.pages.length).toBeGreaterThanOrEqual(1)
    expect(r.buckets.components.length).toBeGreaterThanOrEqual(1)
    expect(r.buckets.hooks.length).toBeGreaterThanOrEqual(1)
    expect(r.all.length).toBeGreaterThan(0)
  })

  it('respects maxFiles cap', () => {
    const r = sampleFiles(PROJ, 'src', ['**/*.ts'], 3)
    expect(r.all.length).toBeLessThanOrEqual(3)
  })

  it('skips test files', () => {
    const r = sampleFiles(PROJ, 'src', ['**/*.ts'])
    const allFiles = r.all.map(f => path.basename(f))
    expect(allFiles).not.toContain('helper.test.ts')
  })

  it('returns empty for non-existent srcDir', () => {
    const r = sampleFiles(PROJ, 'nonexistent', ['**/*.ts'])
    expect(r.all).toHaveLength(0)
  })

  it('deduplicates files across buckets', () => {
    const r = sampleFiles(PROJ, 'src', ['**/*.ts'])
    // Each file should appear at most once across all buckets
    const allFiles = new Set<string>()
    for (const bucket of Object.values(r.buckets)) {
      for (const f of bucket) {
        expect(allFiles.has(f)).toBe(false)
        allFiles.add(f)
      }
    }
  })
})
