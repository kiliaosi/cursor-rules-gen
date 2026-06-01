import type { Language, LibKnowledge } from '../../types.js'
import type { KnowledgeProvider } from '../types.js'

const TABLE: Partial<Record<Language, Omit<LibKnowledge, 'name' | 'version'>>> = {
  typescript: {
    displayName: 'TypeScript', category: 'language',
    summary: 'Typed superset of JavaScript',
    conventions: [
      'Enable strict mode (`"strict": true`).',
      'Prefer `interface` for object shapes; use `type` for unions / intersections.',
      'Use `as const` for literal types.',
      'Avoid `any`; prefer `unknown` when the type is truly unknown.',
    ],
    constraints: [],
    commands: ['tsc --noEmit'],
  },
  javascript: {
    displayName: 'JavaScript', category: 'language',
    summary: 'Dynamic scripting language for the web',
    conventions: [
      'Use `const` by default; `let` only when reassignment is needed.',
      'Prefer arrow functions for callbacks.',
      'Use template literals over string concatenation.',
    ],
    constraints: [], commands: [],
  },
  python: {
    displayName: 'Python', category: 'language',
    summary: 'High-level general-purpose language',
    conventions: [
      'Write type hints (PEP 484+).',
      'Use `from __future__ import annotations` for modern type syntax.',
      'Prefer f-strings over `.format()` / `%` formatting.',
      'Follow PEP 8: `snake_case` for functions / variables, `PascalCase` for classes.',
    ],
    constraints: [], commands: [],
  },
  go: {
    displayName: 'Go', category: 'language',
    summary: 'Statically typed compiled language by Google',
    conventions: [
      'Follow Effective Go and `gofmt` conventions.',
      'Exported names are PascalCase; unexported are camelCase.',
      'Handle errors explicitly — never discard with `_` silently.',
      'Prefer early returns over deep nesting.',
    ],
    constraints: [], commands: ['go build ./...', 'go run .', 'go test ./...', 'go vet ./...'],
  },
  rust: {
    displayName: 'Rust', category: 'language',
    summary: 'Systems language focused on safety and performance',
    conventions: [
      'Follow Rust API Guidelines and `rustfmt` conventions.',
      'Use `snake_case` for functions / variables, `PascalCase` for types / traits.',
      'Prefer `Result<T, E>` over panicking; use `?` for propagation.',
      'Minimize `unsafe` blocks; document safety invariants when used.',
      'Derive common traits (`Debug`, `Clone`, `PartialEq`) where appropriate.',
    ],
    constraints: [], commands: ['cargo build', 'cargo run', 'cargo test', 'cargo clippy', 'cargo fmt'],
  },
  dart: {
    displayName: 'Dart', category: 'language',
    summary: 'Client-optimized language for fast apps on any platform',
    conventions: [
      'Follow the Effective Dart style guide.',
      'Use `lowerCamelCase` for variables / functions, `UpperCamelCase` for classes.',
      'Prefer `final` for locals that are not reassigned.',
      'Use null safety (`?`, `!`, `late`) carefully — avoid `!` unless safe.',
      'Use `const` constructors in widget trees where possible.',
    ],
    constraints: [], commands: ['flutter pub get', 'flutter run', 'flutter test', 'flutter build apk'],
  },
}

export const languageKnowledge: KnowledgeProvider = {
  name: 'static:language',
  resolveLanguage(lang) {
    const entry = TABLE[lang]
    if (!entry) return null
    return { name: lang, version: '', ...entry }
  },
}
