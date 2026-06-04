import type { InspectorExtractor, ProjectConventions } from '../types.js'
import type { ChatTransport } from '../resolver/llm.js'
import { tsReactExtractor } from './extractors/ts-react.js'
import { sampleFiles } from './sampling.js'
import { enhanceWithLLM } from './llm.js'

const extractors: InspectorExtractor[] = [
  tsReactExtractor,
]

export async function inspect(
  projectRoot: string,
  languages: string[],
  srcDir: string,
  transport?: ChatTransport,
): Promise<ProjectConventions> {
  const patterns: ProjectConventions['patterns'] = []
  const conventions: ProjectConventions['conventions'] = []

  // 1. Run all matching extractors (AST deterministic facts)
  for (const ext of extractors) {
    if (!ext.match(languages, projectRoot)) continue
    const result = ext.extract(projectRoot, srcDir)
    patterns.push(...result.patterns)
    conventions.push(...result.conventions)
  }

  const conventions_ast: ProjectConventions = { patterns, conventions }

  // 2. If LLM transport available, enhance with grounded summarisation
  if (transport) {
    const sampling = sampleFiles(projectRoot, srcDir, ['**/*.ts', '**/*.tsx'])
    if (sampling.all.length > 0) {
      return await enhanceWithLLM(projectRoot, conventions_ast, sampling.all, transport)
    }
  }

  return conventions_ast
}

export { tsReactExtractor }
