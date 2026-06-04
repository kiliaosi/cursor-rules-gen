import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ---------------------------------------------------------------------------
// Lazy-loaded @babel/parser — only required if a TS/React extractor runs
// ---------------------------------------------------------------------------
let parser: typeof import('@babel/parser') | null = null
function getParser() {
  if (!parser) parser = require('@babel/parser')
  return parser
}

// ---------------------------------------------------------------------------
// Structured extraction results
// ---------------------------------------------------------------------------

export interface AstExtract {
  file: string
  imports: ImportInfo[]
  exports: ExportInfo[]
  functionCalls: CallInfo[]
  componentType: 'function' | 'class' | 'none'
}

export interface ImportInfo {
  source: string
  names: string[]
  isDefault: boolean
}

export interface ExportInfo {
  name: string
  isDefault: boolean
  kind: 'function' | 'const' | 'class' | 'other'
}

export interface CallInfo {
  name: string
  callee: string
}

// ---------------------------------------------------------------------------
// Hand-written AST walker — avoids @babel/traverse dependency
// ---------------------------------------------------------------------------

interface AstNode {
  type: string
  [key: string]: any
}

interface AstFile {
  type: 'File'
  program: { type: 'Program'; body: AstNode[] }
}

export function parseFile(filePath: string): AstExtract | null {
  try {
    const code = fs.readFileSync(filePath, 'utf-8')
    const p = getParser()!
    const ast = p.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    }) as unknown as AstFile

    const extract: AstExtract = {
      file: filePath,
      imports: [],
      exports: [],
      functionCalls: [],
      componentType: 'none',
    }

    walkNode(ast.program, extract)
    return extract
  } catch {
    return null
  }
}

function walkNode(node: AstNode, out: AstExtract): void {
  if (!node || typeof node !== 'object') return

  switch (node.type) {
    case 'ImportDeclaration':
      if (node.source && node.specifiers) {
        const info: ImportInfo = { source: String(node.source.value ?? ''), names: [], isDefault: false }
        for (const s of node.specifiers) {
          if (s.type === 'ImportDefaultSpecifier') {
            info.names.push(String(s.local?.name ?? ''))
            info.isDefault = true
          } else if (s.type === 'ImportSpecifier') {
            info.names.push(String(s.imported?.name ?? s.local?.name ?? ''))
          }
        }
        if (info.names.length > 0) out.imports.push(info)
      }
      break

    case 'ExportNamedDeclaration':
      if (node.declaration) {
        const exp = extractExport(node.declaration)
        if (exp) out.exports.push(exp)
      }
      if (node.specifiers) {
        for (const s of node.specifiers) {
          if (s.type === 'ExportSpecifier') {
            out.exports.push({
              name: String(s.exported?.name ?? s.local?.name ?? ''),
              isDefault: false,
              kind: 'other',
            })
          }
        }
      }
      break

    case 'ExportDefaultDeclaration':
      out.exports.push({
        name: 'default',
        isDefault: true,
        kind: node.declaration?.type === 'FunctionDeclaration'
          || node.declaration?.type === 'ArrowFunctionExpression' ? 'function' : 'other',
      })
      break

    case 'CallExpression':
      recordCall(node, out)
      break

    case 'FunctionDeclaration': {
      const name = node.id?.name ?? ''
      if (isComponentName(name)) out.componentType = 'function'
      break
    }
    case 'VariableDeclarator': {
      const name = node.id?.name ?? ''
      if (isComponentName(name)) {
        const initType = node.init?.type
        if (initType === 'ArrowFunctionExpression' || initType === 'FunctionExpression') {
          out.componentType = 'function'
        }
      }
      break
    }
    case 'ClassDeclaration':
      if (node.superClass) out.componentType = 'class'
      break
  }

  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'errors') continue
    const child = node[key]
    if (Array.isArray(child)) {
      for (const item of child) walkNode(item, out)
    } else if (child && typeof child === 'object') {
      walkNode(child, out)
    }
  }
}

function extractExport(decl: AstNode): ExportInfo | null {
  if (decl.type === 'FunctionDeclaration') {
    return { name: decl.id?.name ?? 'anonymous', isDefault: false, kind: 'function' }
  }
  if (decl.type === 'VariableDeclaration') {
    const name = decl.declarations?.[0]?.id?.name ?? ''
    return { name, isDefault: false, kind: 'const' }
  }
  if (decl.type === 'ClassDeclaration') {
    return { name: decl.id?.name ?? 'anonymous', isDefault: false, kind: 'class' }
  }
  return null
}

function recordCall(node: AstNode, out: AstExtract): void {
  const callee = getCallPath(node.callee)
  if (!callee) return
  const name = callee.split('.').pop() ?? callee
  out.functionCalls.push({ name, callee })
}

function getCallPath(node: AstNode): string | null {
  if (!node) return null
  if (node.type === 'Identifier') return String(node.name ?? '')
  if (node.type === 'MemberExpression') {
    const obj = getCallPath(node.object)
    const prop = node.computed ? null : String(node.property?.name ?? '')
    return obj && prop ? `${obj}.${prop}` : null
  }
  return null
}

function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name) && name.length > 0
}
