import type { KnowledgeProvider } from '../types.js'

import { nodeKnowledge } from './node.js'
import { pythonKnowledge } from './python.js'
import { goKnowledge } from './go.js'
import { rustKnowledge } from './rust.js'
import { dartKnowledge } from './dart.js'
import { languageKnowledge } from './language.js'
import { packageManagerKnowledge } from './pm.js'
import { monorepoKnowledge } from './monorepo.js'

/**
 * Static knowledge providers — declarative tables shipped with the tool.
 * Used as the final fallback when LLM resolution is disabled or fails.
 *
 * Each provider answers ONE dimension (deps / language / pm / monorepo)
 * and ignores the rest. The orchestrator picks the first non-null result.
 */
export const staticProviders: KnowledgeProvider[] = [
  // Per-ecosystem dep providers
  nodeKnowledge,
  pythonKnowledge,
  goKnowledge,
  rustKnowledge,
  dartKnowledge,
  // Cross-cutting providers
  languageKnowledge,
  packageManagerKnowledge,
  monorepoKnowledge,
]
