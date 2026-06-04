import fs from 'node:fs'
import path from 'node:path'
import type { LibCategory, LibKnowledge, RawDep } from '../types.js'
import type { KnowledgeProvider } from './types.js'
import { depKey } from './types.js'

// ---------------------------------------------------------------------------
// SKILL.md → LibKnowledge
// ---------------------------------------------------------------------------

interface SkillFrontmatter {
  name?: string
  description?: string
  tags?: string[]
}

/** Minimal YAML frontmatter parser — good enough for SKILL.md headers. */
function parseFrontmatter(raw: string): { fm: SkillFrontmatter; body: string } {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  if (!m) return { fm: {}, body: raw }

  const fm: SkillFrontmatter = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*)\s*:\s*(.+?)\s*$/)
    if (!kv) continue
    const key = kv[1]
    let val: string | string[] = kv[2].trim().replace(/^['"]|['"]$/g, '')

    // Inline array: tags: [a, b, c]
    const arr = val.match(/^\[(.+)\]$/)
    if (arr) val = arr[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''))

    if (key === 'name') fm.name = val as string
    else if (key === 'description') fm.description = val as string
    else if (key === 'tags') fm.tags = Array.isArray(val) ? val : [val]
  }

  return { fm, body: raw.slice(m[0].length) }
}

const TAG_CATEGORY: Record<string, LibCategory> = {
  framework: 'framework', ui: 'ui', state: 'state',
  testing: 'testing', test: 'testing',
  build: 'build', bundler: 'build',
  styling: 'styling', css: 'styling',
  database: 'database', db: 'database', orm: 'database',
  devtool: 'devtool', tooling: 'tooling', lint: 'devtool',
}

function categoryFromTags(tags: string[]): LibCategory {
  for (const t of tags) {
    const c = TAG_CATEGORY[t.toLowerCase()]
    if (c) return c
  }
  return 'utility'
}

/** Extract bullet lists from ## sections of the SKILL.md body. */
function extractBullets(body: string, heading: string): string[] {
  const re = new RegExp(`##\\s+${heading}\\s*\\n((?:[ \t]*[-*]\\s+.+\\n?)*)`, 'im')
  const m = body.match(re)
  if (!m) return []
  return m[1].split('\n')
    .map(l => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean)
}

function skillToKnowledge(pkgName: string, version: string, raw: string): LibKnowledge {
  const { fm, body } = parseFrontmatter(raw)
  const tags = fm.tags ?? []
  const conventions = extractBullets(body, 'Conventions?')
  const commands = extractBullets(body, 'Commands?')

  // Backtick-wrapped commands → strip backticks
  const cleanCmds = commands.map(c => c.replace(/^`|`$/g, ''))

  return {
    name: pkgName,
    displayName: fm.name ?? pkgName,
    version,
    category: categoryFromTags(tags),
    variant: tags.find(t => !TAG_CATEGORY[t.toLowerCase()]) || undefined,
    summary: fm.description ?? '',
    conventions: conventions.length > 0 ? conventions : extractBullets(body, 'Usage'),
    constraints: extractBullets(body, 'Constraints?'),
    commands: cleanCmds,
  }
}

// ---------------------------------------------------------------------------
// Discovery — scan node_modules for skills/*/SKILL.md
// ---------------------------------------------------------------------------

const SKILL_GLOB = /^(.+?[\\/])?node_modules[\\/](@[^\\/]+[\\/][^\\/]+|[^@\\/][^\\/]*)[\\/]skills[\\/][^\\/]+[\\/]SKILL\.md$/i

export interface SkillEntry {
  packageName: string
  knowledge: LibKnowledge
}

/** Walk `node_modules` looking for Agent Skill files. */
export function discoverSkills(projectRoot: string): Map<string, LibKnowledge> {
  const results = new Map<string, LibKnowledge>()
  const modulesRoot = path.join(projectRoot, 'node_modules')
  if (!fs.existsSync(modulesRoot)) return results
  walk(modulesRoot, results, modulesRoot)
  return results
}

function walk(dir: string, out: Map<string, LibKnowledge>, root: string): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch { return }

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (!entry.isDirectory()) continue

    // Skip deeply nested node_modules (transitive)
    if (entry.name === 'node_modules') continue
    if (entry.name.startsWith('.') || entry.name.startsWith('@types')) continue

    // Check for skills/ dir at this level
    const skillsDir = path.join(full, 'skills')
    if (fs.existsSync(skillsDir)) {
      try {
        for (const skillEntry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
          if (!skillEntry.isDirectory()) continue
          const skillFile = path.join(skillsDir, skillEntry.name, 'SKILL.md')
          if (!fs.existsSync(skillFile)) continue
          try {
            const raw = fs.readFileSync(skillFile, 'utf-8')
            const pkgName = path.relative(root, full).replace(/\\/g, '/')
            const knowledge = skillToKnowledge(pkgName, '', raw)
            out.set(pkgName, knowledge)
            // Also register the short name (e.g. "react-query" from "@tanstack/react-query")
            if (pkgName.includes('/')) {
              out.set(pkgName.split('/').pop()!, knowledge)
            }
            break // first skill file wins
          } catch { /* unreadable SKILL.md — skip */ }
        }
      } catch { /* unreadable skills dir — skip */ }
    }

    // Recurse into scoped packages (@scope/pkg) but not deeper than needed
    if (entry.name.startsWith('@')) {
      walk(full, out, root)
    }
  }
}

// ---------------------------------------------------------------------------
// KnowledgeProvider wrapper
// ---------------------------------------------------------------------------

/**
 * Reads Agent Skill files (SKILL.md) from installed node_modules and exposes
 * them as a `KnowledgeProvider`. Placed at the front of the resolver chain so
 * library maintainers' own knowledge always takes priority.
 */
export function skillsProvider(projectRoot: string): KnowledgeProvider {
  const skills = discoverSkills(projectRoot)

  return {
    name: 'skills',
    resolveDep(dep: RawDep) {
      if (dep.ecosystem !== 'node') return null
      const k = skills.get(dep.name) ?? skills.get(dep.name.split('/').pop() ?? '')
      if (!k) return null
      // Carry the actually-detected version from the project manifest.
      return { ...k, version: dep.version || k.version }
    },
  }
}

export { SKILL_GLOB }
