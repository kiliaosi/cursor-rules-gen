import type { ResolvedProject, RuleFile, RuleGenerator } from '../types.js'
import { stackGenerator } from './stack.js'
import { codingStyleGenerator } from './coding-style.js'
import { workflowGenerator } from './workflow.js'

/**
 * Rule generator registry. Each generator is a self-contained plugin that
 * consumes a fully-resolved project and emits a single `.mdc` file.
 *
 * Adding a new rule file:
 *   1. Create `generators/<file>.ts` implementing `RuleGenerator`
 *   2. Add it to the array below
 */
export const ruleGenerators: RuleGenerator[] = [
  stackGenerator,
  codingStyleGenerator,
  workflowGenerator,
]

export function generateRules(project: ResolvedProject): RuleFile[] {
  return ruleGenerators.map(g => g.generate(project))
}
