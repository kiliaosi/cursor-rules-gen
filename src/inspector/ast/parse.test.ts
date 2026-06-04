import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { parseFile } from './parse.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(__dirname, '__fixtures_ast')

function write(file: string, content: string): string {
  const p = path.join(FIXTURES, file)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content, 'utf-8')
  return p
}

beforeAll(() => {
  fs.mkdirSync(FIXTURES, { recursive: true })
})

afterAll(() => {
  fs.rmSync(FIXTURES, { recursive: true, force: true })
})

describe('parseFile', () => {
  it('parses import declarations correctly', () => {
    const f = write('imports.ts', `
      import React from 'react'
      import { useState, useEffect } from 'react'
    `)
    const r = parseFile(f)!
    expect(r.imports).toHaveLength(2)
    expect(r.imports[0].source).toBe('react')
    expect(r.imports[0].names).toEqual(['React'])
    expect(r.imports[0].isDefault).toBe(true)
    expect(r.imports[1].source).toBe('react')
    expect(r.imports[1].names).toEqual(['useState', 'useEffect'])
  })

  it('parses named exports', () => {
    const f = write('exports.ts', `
      export function foo() {}
      export const bar = 42
    `)
    const r = parseFile(f)!
    expect(r.exports.length).toBeGreaterThanOrEqual(2)
    const foos = r.exports.filter(e => e.name === 'foo')
    expect(foos.length).toBeGreaterThan(0)
    expect(foos[0].isDefault).toBe(false)
  })

  it('parses default function export', () => {
    const f = write('default-export.ts', `
      export default function MyComponent() { return null }
    `)
    const r = parseFile(f)!
    const defs = r.exports.filter(e => e.isDefault)
    expect(defs.length).toBeGreaterThan(0)
  })

  it('detects function calls (hooks)', () => {
    const f = write('hooks.tsx', `
      import { useIntl } from 'react-intl'
      export function MyPage() {
        const intl = useIntl()
        const t = useIntl()
        return <div>{intl.formatMessage({})}</div>
      }
    `)
    const r = parseFile(f)!
    const intlCalls = r.functionCalls.filter(c => c.callee === 'useIntl')
    expect(intlCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('detects functional component type', () => {
    const f = write('app.tsx', `
      export function App() { return <div/> }
    `)
    const r = parseFile(f)!
    expect(r.componentType).toBe('function')
  })

  it('parses request helper import', () => {
    const f = write('request.ts', `
      import request from '@/utils/request'
      import { httpClient } from '@/lib/http'
    `)
    const r = parseFile(f)!
    expect(r.imports[0].source).toBe('@/utils/request')
    expect(r.imports[0].names).toEqual(['request'])
    expect(r.imports[0].isDefault).toBe(true)
    expect(r.imports[1].source).toBe('@/lib/http')
    expect(r.imports[1].names).toEqual(['httpClient'])
  })

  it('handles JSX + TypeScript syntax', () => {
    const f = write('tsx-test.tsx', `
      import React from 'react'
      interface Props { name: string }
      export const Hello: React.FC<Props> = ({ name }) => <h1>{name}</h1>
    `)
    const r = parseFile(f)!
    expect(r.imports.length).toBeGreaterThanOrEqual(1)
    expect(r.exports.length).toBeGreaterThanOrEqual(1)
  })

  it('returns null for syntax errors', () => {
    const f = write('broken.ts', 'const x =')
    const r = parseFile(f)
    expect(r).toBeNull()
  })

  it('handles empty file', () => {
    const f = write('empty.ts', '')
    const r = parseFile(f)!
    expect(r.imports).toHaveLength(0)
    expect(r.exports).toHaveLength(0)
  })

  it('detects axios.get pattern', () => {
    const f = write('axios-call.ts', `
      import axios from 'axios'
      axios.get('/api/data')
    `)
    const r = parseFile(f)!
    const axiosCalls = r.functionCalls.filter(c => c.callee === 'axios.get')
    expect(axiosCalls.length).toBeGreaterThanOrEqual(1)
  })
})
