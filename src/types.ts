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
// Config facts — deterministic, read from config files (Phase 0)
// ----------------------------------------------------------------------------

export interface TsupConfigInfo {
  /** Whether tsup.config.ts exists */
  exists: boolean
  /** Entry module names (e.g. ["cli", "extension"]) */
  entries: string[]
  /** Output formats (e.g. ["esm", "cjs"]) */
  formats: string[]
  /** Build target (e.g. "node18") */
  target?: string
}

export interface ProjectConfig {
  /** From package.json engines (e.g. { node: ">=18", vscode: "^1.90.0" }) */
  engines?: Record<string, string>
  /** From package.json "type" field */
  packageType?: 'module' | 'commonjs'
  /** tsconfig compilerOptions.strict */
  tsStrict: boolean
  /** tsconfig compilerOptions.moduleResolution */
  tsModuleResolution?: string
  /** tsconfig compilerOptions.target */
  tsTarget?: string
  /** tsconfig compilerOptions.paths (alias map) */
  tsconfigPaths?: Record<string, string[]>
  /** Has activationEvents + contributes (VSCode extension) */
  isVscodeExtension: boolean
  /** .vscodeignore exists */
  hasVscodeignore: boolean
  /** tsup.config.ts extracted info */
  tsupConfig: TsupConfigInfo
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
  /** Config facts merged from ecosystem plugins. */
  config: ProjectConfig
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
  /** Deterministic config facts (engines, tsconfig, etc.). */
  config?: ProjectConfig
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
  /** Deterministic config facts from the project's config files. */
  config: ProjectConfig
}

export interface ResolvedProject {
  meta: ProjectMeta
  libs: LibKnowledge[]
  /** Source-code extracted conventions (populated in --deep mode). */
  conventions?: ProjectConventions
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

// ============================================================================
// Inspector types — source-code pattern extraction (Phase 1+)
// ============================================================================

export type SampleBucket = 'pages' | 'components' | 'hooks' | 'services' | 'layouts' | 'utils'

export interface ProjectPattern {
  type: string
  label: string
  evidence: string[]
  detail?: string
}

export interface ProjectConventions {
  patterns: ProjectPattern[]
  conventions: Convention[]
}

export interface Convention {
  rule: string
  evidence: string[]
}

export interface InspectorExtractor {
  name: string
  match(languages: string[], projectRoot: string): boolean
  extract(projectRoot: string, srcDir: string): ProjectConventions
}
