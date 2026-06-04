import type { ResolvedProject, RuleFile, RuleGenerator } from '../types.js'
import { stackGenerator } from './stack.js'
import { codingStyleGenerator } from './coding-style.js'
import { workflowGenerator } from './workflow.js'
import { conventionsGenerator } from './conventions.js'

export const ruleGenerators: RuleGenerator[] = [
  stackGenerator,
  codingStyleGenerator,
  workflowGenerator,
  conventionsGenerator,
]

export function generateRules(project: ResolvedProject): RuleFile[] {
  return ruleGenerators.map(g => g.generate(project))
}
