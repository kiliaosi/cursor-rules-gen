import { describe, it, expect } from 'vitest'
import type { LibCategory, LibKnowledge, MonorepoInfo, PackageManager, RawDep } from '../../types.js'
import { staticProviders } from './index.js'
import type { KnowledgeProvider } from '../types.js'

function findProvider(name: string): KnowledgeProvider | undefined {
  return staticProviders.find(p => p.name === name)
}

function resolveDep(providerName: string, depName: string, ecosystem: RawDep['ecosystem'] = 'node', version = '1.0.0') {
  const p = findProvider(providerName)
  const r = p?.resolveDep?.({ name: depName, version, ecosystem })
  return r as LibKnowledge | null
}

describe('static knowledge providers', () => {
  describe('nodeKnowledge', () => {
    it('resolves react', () => {
      const r = resolveDep('static:node', 'react')
      expect(r).not.toBeNull()
      expect(r!.displayName).toBe('React')
      expect(r!.category).toBe('framework')
      expect(r!.conventions.length).toBeGreaterThan(0)
    })

    it('resolves next.js', () => {
      const r = resolveDep('static:node', 'next')
      expect(r!.displayName).toBe('Next.js')
      expect(r!.commands).toContain('next dev')
    })

    it('resolves vitest', () => {
      const r = resolveDep('static:node', 'vitest')
      expect(r!.displayName).toBe('Vitest')
      expect(r!.category).toBe('testing')
    })

    it('resolves tailwindcss', () => {
      const r = resolveDep('static:node', 'tailwindcss')
      expect(r!.displayName).toBe('Tailwind CSS')
      expect(r!.category).toBe('styling')
      expect(r!.conventions.length).toBeGreaterThan(0)
    })

    it('resolves tsup', () => {
      const r = resolveDep('static:node', 'tsup')
      expect(r!.displayName).toBe('tsup')
      expect(r!.category).toBe('build')
    })

    it('returns null for unknown dep', () => {
      const p = findProvider('static:node')
      const r = p?.resolveDep?.({ name: 'nonexistent-lib', version: '1.0.0', ecosystem: 'node' }) as LibKnowledge | null
      expect(r).toBeNull()
    })

    it('returns null for wrong ecosystem', () => {
      const p = findProvider('static:node')
      const r = p?.resolveDep?.({ name: 'react', version: '18.0.0', ecosystem: 'python' }) as LibKnowledge | null
      expect(r).toBeNull()
    })

    it('resolves version-constrained entry (antd)', () => {
      const r = resolveDep('static:node', 'antd')
      expect(r!.constraints.length).toBeGreaterThan(0)
    })

    it('resolves react-router with version constraint', () => {
      const r = resolveDep('static:node', 'react-router-dom')
      expect(r!.constraints.length).toBeGreaterThan(0)
    })

    it('resolves via scoped package name (@reduxjs/toolkit)', () => {
      const r = resolveDep('static:node', '@reduxjs/toolkit')
      expect(r!.displayName).toBe('Redux Toolkit')
    })
  })

  describe('languageKnowledge', () => {
    it('resolves typescript language', () => {
      const p = findProvider('static:language')
      const r = p?.resolveLanguage?.('typescript') as LibKnowledge | null
      expect(r).not.toBeNull()
      expect(r!.displayName).toBe('TypeScript')
      expect(r!.category).toBe('language')
      expect(r!.conventions.length).toBeGreaterThan(0)
    })

    it('resolves python language', () => {
      const p = findProvider('static:language')
      const r = p?.resolveLanguage?.('python') as LibKnowledge | null
      expect(r!.displayName).toBe('Python')
    })

    it('returns null for unknown language', () => {
      const p = findProvider('static:language')
      const r = p?.resolveLanguage?.('unknown') as LibKnowledge | null
      expect(r).toBeNull()
    })
  })

  describe('packageManagerKnowledge', () => {
    it('resolves pnpm', () => {
      const p = findProvider('static:pm')
      const r = p?.resolvePackageManager?.('pnpm') as LibKnowledge | null
      expect(r!.displayName).toBe('pnpm')
      expect(r!.commands.length).toBeGreaterThan(0)
    })

    it('returns null for unknown', () => {
      const p = findProvider('static:pm')
      const r = p?.resolvePackageManager?.('unknown') as LibKnowledge | null
      expect(r).toBeNull()
    })
  })

  describe('monorepoKnowledge', () => {
    it('resolves turborepo', () => {
      const p = findProvider('static:monorepo')
      const r = p?.resolveMonorepo?.({ tool: 'turborepo', workspaces: [] }) as LibKnowledge | null
      expect(r).not.toBeNull()
      expect(r!.displayName).toContain('Turbo')
    })

    it('resolves nx', () => {
      const p = findProvider('static:monorepo')
      const r = p?.resolveMonorepo?.({ tool: 'nx', workspaces: [] }) as LibKnowledge | null
      expect(r).not.toBeNull()
      expect(r!.displayName).toContain('Nx')
    })
  })
})
