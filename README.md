# cursor-rules-gen

> Auto-generate `.cursor/rules/` from your project's tech stack. Works as a CLI **and** a Cursor/VSCode extension.

## Why?

Every Cursor user needs rules to get better AI assistance, but writing them from scratch is tedious. This tool scans your dependency manifests and project structure, resolves what each library *is* and *how to use it*, then generates tailored rules in seconds.

Knowledge can come from a built-in static table (offline, zero-config) **or** from an LLM that analyzes your actual dependencies — your choice.

## Install & Run

```bash
# No install needed — just run:
npx cursor-rules-gen

# Specific project:
npx cursor-rules-gen ./my-project

# Preview without writing files:
npx cursor-rules-gen --dry-run

# Diff against existing rules:
npx cursor-rules-gen --diff

# Use an LLM to analyze unknown dependencies:
npx cursor-rules-gen --llm            # reads OPENAI_API_KEY
```

## Architecture

A three-stage pipeline, each stage fully pluggable:

```
Scan ──▶ Resolve ──▶ Generate
 │          │            │
 │          │            └─ generators/*  consume LibKnowledge[] → .mdc files
 │          └─ resolver/   [cache → llm → static] producing LibKnowledge
 └─ scanner/  ecosystem plugins → raw deps + project signals
```

- **`scanner/plugins/*`** — one plugin per ecosystem (node, python, go, rust, dart, generic). Each only parses manifests and emits `RawDep[]` + project signals. No knowledge baked in.
- **`resolver/`** — a chain of `KnowledgeProvider`s resolved "first non-null wins". The static providers are declarative tables; the LLM provider batches deps to an OpenAI-compatible API; the cache provider persists LLM results by `name@major`.
- **`generators/*`** — each `RuleGenerator` consumes the unified `LibKnowledge[]` and emits one `.mdc` file. They never branch on specific library names.

Adding a language = drop a file in `scanner/plugins/` + a table in `resolver/static/`. No edits to the core engine.

## What it generates

Three rule files in `.cursor/rules/`:

| File | Content |
|---|---|
| `tech-stack.mdc` | Languages, frameworks, version constraints, monorepo info, sub-projects |
| `coding-style.mdc` | Per-library conventions, language idioms, universal rules |
| `dev-workflow.mdc` | Package-manager + per-tool commands, testing, git conventions |

A `.manifest.json` is also written to track scanned dependencies for incremental runs.

## Cursor / VSCode Extension

The same engine ships as an editor extension that uses the built-in language model (`vscode.lm`) — **no API key needed**.

- Command: **`Cursor Rules: Generate`** — scan + resolve (via the editor's LLM) + write
- Command: **`Cursor Rules: Preview (no write)`** — open the generated rules in an editor tab
- Prompts on opening a project that has no `.cursor/rules/` (configurable)
- Diff-aware: existing files that differ require explicit confirmation before overwrite

## Smart updates

- **Non-destructive** — new files are written; existing files that differ are protected.
- **`--diff`** — show a line-level diff of what *would* change, without writing.
- **`--force`** — overwrite changed files.
- **Incremental** — reports which dependencies are new since the last generation (via the manifest).

## Options

```
npx cursor-rules-gen [project-dir] [options]

Options:
  --dry-run         Preview generated rules without writing files
  --diff            Show diff against existing rules (no write)
  --force, -f       Overwrite existing rule files
  --llm             Use LLM-powered knowledge resolution
  --api-key <key>   API key for LLM (or set OPENAI_API_KEY)
  --api-base <url>  Override API base URL (OpenAI-compatible)
  --model <name>    Override LLM model name
  --no-cache        Bypass local knowledge cache
  --help, -h        Show help
```

## What it detects

| Category | Examples |
|---|---|
| **Frameworks** | React, Vue, Next.js, Nuxt, Angular, Svelte, UmiJS, Astro; Django, Flask, FastAPI; Gin, Echo, Fiber; Actix, Axum, Tauri; Flutter |
| **State** | Zustand, Redux Toolkit, MobX, Pinia, Jotai, TanStack Query, DVA; BLoC, Riverpod |
| **Build / Testing** | Vite, Rsbuild, Webpack, tsup; Vitest, Jest, Playwright, Cypress, pytest, testify, criterion |
| **Styling / DB** | Tailwind, Sass, Less, styled-components; Prisma, TypeORM, Drizzle, SQLAlchemy, GORM, Diesel |
| **Monorepo / PM** | pnpm/Yarn/npm workspaces, Nx, Turborepo, Cargo workspaces; npm, yarn, pnpm, bun, uv, poetry, pdm, cargo, go modules |

Unknown libraries are simply skipped in static mode, or resolved on-the-fly in `--llm` mode.

## License

MIT © [kiliaosi](https://github.com/kiliaosi)
