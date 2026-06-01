// ============================================================================
// Core domain types
// ============================================================================

export type Language =
  | 'typescript' | 'javascript'
  | 'python' | 'go' | 'rust' | 'dart'
  | 'java' | 'kotlin' | 'csharp'
  | 'ruby' | 'php'
  | 'unknown'

export type PackageManager =
  | 'npm' | 'yarn' | 'pnpm' | 'bun'
  | 'pip' | 'poetry' | 'uv' | 'pdm' | 'conda'
  | 'go modules'
  | 'cargo'
  | 'flutter'
  | 'maven' | 'gradle'
  | 'unknown'

export type Ecosystem = 'node' | 'python' | 'go' | 'rust' | 'dart' | 'unknown'

export type LibCategory =
  | 'language' | 'framework' | 'ui' | 'state' | 'testing' | 'build'
  | 'styling' | 'database' | 'utility' | 'devtool' | 'tooling'

// ----------------------------------------------------------------------------
// Library knowledge — the universal currency between resolver and generator
// ----------------------------------------------------------------------------

export interface LibKnowledge {
  /** Canonical name (e.g. "react", "github.com/gin-gonic/gin") */
  name: string
  /** Display name (e.g. "React", "Gin") */
  displayName: string
  /** Detected version, or "" if unknown */
  version: string
  /** Coarse category — drives section grouping in generators */
  category: LibCategory
  /** Optional sub-classification (e.g. "Web framework", "AI/ML") */
  variant?: string
  /** One-sentence description */
  summary: string
  /** Coding/usage conventions (bullets) */
  conventions: string[]
  /** Version/compat constraints (bullets) */
  constraints: string[]
  /** CLI commands relevant to this library */
  commands: string[]
}

// ----------------------------------------------------------------------------
// Scanner output
// ----------------------------------------------------------------------------

export interface RawDep {
  name: string
  version: string
  ecosystem: Ecosystem
}

export interface MonorepoInfo {
  tool: string
  workspaces: string[]
  /** Secondary build tools layered on top (e.g. ['nx'] alongside pnpm). */
  extraTools?: string[]
}

export interface ScannedSubProject {
  name: string
  path: string
  languages: Language[]
  deps: RawDep[]
}

export interface ScanResult {
  languages: Language[]
  packageManagers: PackageManager[]
  monorepo: MonorepoInfo | null
  srcDir: string | null
  ci: string | null
  containerized: boolean
  deps: RawDep[]
  subProjects: ScannedSubProject[]
  /** Root-level run scripts (e.g. package.json#scripts), name → command. */
  scripts: Record<string, string>
}

// ----------------------------------------------------------------------------
// Scanner plugin contract
// ----------------------------------------------------------------------------

export interface ScannerPluginResult {
  languages: Language[]
  deps?: RawDep[]
  packageManagers?: PackageManager[]
  monorepo?: MonorepoInfo | null
  ci?: string | null
  containerized?: boolean
  /** Run scripts surfaced by this ecosystem (name → command). */
  scripts?: Record<string, string>
}

export interface ScannerPlugin {
  name: string
  match(root: string): boolean
  detect(root: string): ScannerPluginResult
}

// ----------------------------------------------------------------------------
// Resolved project — the input to generators
// ----------------------------------------------------------------------------

export interface ResolvedSubProject {
  name: string
  path: string
  languages: Language[]
  frameworks: string[]
}

export interface ProjectMeta {
  name: string
  root: string
  languages: Language[]
  packageManagers: PackageManager[]
  monorepo: MonorepoInfo | null
  srcDir: string | null
  ci: string | null
  containerized: boolean
  subProjects: ResolvedSubProject[]
  /** Root-level run scripts (name → command). */
  scripts: Record<string, string>
}

export interface ResolvedProject {
  meta: ProjectMeta
  libs: LibKnowledge[]
}

// ----------------------------------------------------------------------------
// Generator contract
// ----------------------------------------------------------------------------

export interface RuleFile {
  filename: string
  content: string
  description: string
}

export interface RuleGenerator {
  name: string
  generate(project: ResolvedProject): RuleFile
}

// ----------------------------------------------------------------------------
// Resolver options
// ----------------------------------------------------------------------------

export interface ResolveOptions {
  mode: 'static' | 'llm'
  /** Prefer the local `cursor-agent` CLI (uses Cursor subscription models). */
  cursorCli?: boolean
  apiKey?: string
  apiBase?: string
  /** Model id — for Cursor CLI use `auto` or an id from `--list-models`. */
  model?: string
  noCache?: boolean
}
