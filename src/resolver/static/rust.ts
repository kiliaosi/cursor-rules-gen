import { createEcosystemProvider, type KnowledgeTable } from './_table.js'

const TABLE: KnowledgeTable = {
  // ---------- Frameworks ----------
  actix_web: { displayName: 'Actix Web', category: 'framework', variant: 'Web framework', summary: 'Powerful Rust web framework' },
  axum: { displayName: 'Axum', category: 'framework', variant: 'Web framework', summary: 'Ergonomic Rust web framework on Tokio' },
  rocket: { displayName: 'Rocket', category: 'framework', variant: 'Web framework', summary: 'Rust web framework with codegen' },
  warp: { displayName: 'Warp', category: 'framework', variant: 'Web framework', summary: 'Composable Rust web framework' },
  tonic: { displayName: 'Tonic', category: 'framework', variant: 'gRPC framework', summary: 'gRPC framework for Rust' },
  tauri: { displayName: 'Tauri', category: 'framework', variant: 'Desktop framework', summary: 'Lightweight desktop app framework' },
  leptos: { displayName: 'Leptos', category: 'framework', variant: 'Full-stack Web', summary: 'Full-stack Rust web framework' },
  yew: { displayName: 'Yew', category: 'framework', variant: 'WASM frontend', summary: 'Rust WASM frontend framework' },
  dioxus: { displayName: 'Dioxus', category: 'framework', variant: 'Cross-platform UI', summary: 'Cross-platform Rust UI framework' },
  bevy: { displayName: 'Bevy', category: 'framework', variant: 'Game engine', summary: 'Data-driven Rust game engine' },
  clap: { displayName: 'Clap', category: 'framework', variant: 'CLI framework', summary: 'Rust CLI argument parser' },
  tokio: { displayName: 'Tokio', category: 'utility', variant: 'Async runtime', summary: 'Asynchronous runtime for Rust' },
  async_std: { displayName: 'async-std', category: 'utility', variant: 'Async runtime', summary: 'Async standard library for Rust' },

  // ---------- Testing ----------
  proptest: { displayName: 'proptest', category: 'testing', summary: 'Property-based testing for Rust', conventions: ['Use `proptest!` macro for generative tests.'] },
  criterion: { displayName: 'Criterion', category: 'testing', summary: 'Statistics-driven benchmarking', commands: ['cargo bench'] },
  mockall: { displayName: 'mockall', category: 'testing', summary: 'Mocking library for Rust' },
  rstest: { displayName: 'rstest', category: 'testing', summary: 'Fixture-based testing for Rust' },

  // ---------- Databases ----------
  diesel: { displayName: 'Diesel', category: 'database', summary: 'Safe, extensible Rust ORM' },
  sqlx: { displayName: 'SQLx', category: 'database', summary: 'Async SQL toolkit for Rust' },
  sea_orm: { displayName: 'SeaORM', category: 'database', summary: 'Async ORM for Rust' },

  // ---------- Utility / Dev tools ----------
  serde: { displayName: 'Serde', category: 'utility', summary: 'Serialization framework for Rust' },
  tracing: { displayName: 'tracing', category: 'utility', summary: 'Application-level tracing for Rust' },
  anyhow: { displayName: 'anyhow', category: 'utility', summary: 'Flexible error handling for Rust' },
  thiserror: { displayName: 'thiserror', category: 'utility', summary: 'Derive macro for custom error types' },
}

export const rustKnowledge = createEcosystemProvider('static:rust', 'rust', TABLE)
