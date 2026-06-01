import { createEcosystemProvider, type KnowledgeTable } from './_table.js'

const TABLE: KnowledgeTable = {
  // ---------- Frameworks ----------
  react: {
    displayName: 'React', category: 'framework',
    summary: 'Component-based UI library',
    conventions: [
      'Use functional components with hooks; avoid class components.',
      'Extract reusable logic into custom hooks.',
      'Prefer composition over inheritance.',
      'Colocate state with the component that uses it.',
    ],
  },
  next: {
    displayName: 'Next.js', category: 'framework', variant: 'Full-stack React',
    summary: 'React meta-framework with SSR, SSG, and API routes',
    conventions: ['Use App Router with server components by default.', 'Prefer server actions for mutations.', 'Use `next/image` for optimized images.'],
    constraints: ['App Router requires React 18+.', 'Server components cannot use hooks or browser APIs.'],
    commands: ['next dev', 'next build', 'next start'],
  },
  nuxt: {
    displayName: 'Nuxt', category: 'framework', variant: 'Full-stack Vue',
    summary: 'Vue meta-framework with SSR and auto-imports',
    conventions: ['Use `<script setup>` syntax.', 'Leverage auto-imports for composables.'],
    commands: ['nuxi dev', 'nuxi build'],
  },
  gatsby: { displayName: 'Gatsby', category: 'framework', variant: 'Static React', summary: 'Static site generator for React', commands: ['gatsby develop', 'gatsby build'] },
  remix: { displayName: 'Remix', category: 'framework', variant: 'Full-stack React', summary: 'React framework focused on web standards', conventions: ['Use loaders for data, actions for mutations.'] },
  '@remix-run/react': { displayName: 'Remix', category: 'framework', variant: 'Full-stack React', summary: 'React framework focused on web standards' },
  vue: {
    displayName: 'Vue', category: 'framework',
    summary: 'Progressive framework for building UIs',
    conventions: [
      'Use Composition API with `<script setup>`.',
      'Prefer `ref()` / `reactive()` for reactive state.',
      'Use `defineProps` / `defineEmits` for component contracts.',
    ],
  },
  svelte: {
    displayName: 'Svelte', category: 'framework',
    summary: 'Compile-time UI framework with minimal runtime',
    conventions: ['Use reactive declarations (`$:`) for derived values.', 'Keep components small and focused.'],
  },
  '@angular/core': {
    displayName: 'Angular', category: 'framework',
    summary: 'Full-featured framework by Google',
    conventions: ['Follow the Angular style guide.', 'Use standalone components.', 'Prefer signals for reactive state.'],
  },
  umi: {
    displayName: 'UmiJS', category: 'framework', variant: 'Enterprise React',
    summary: 'Pluggable enterprise React framework',
    conventions: ['Follow convention-based routing (`pages/` = routes).'],
    constraints: ['Umi 3 ships convention-based routing and DVA for state.'],
    commands: ['umi dev', 'umi build'],
  },
  '@umijs/max': { displayName: 'UmiJS Max', category: 'framework', variant: 'Enterprise React', summary: 'Full-featured UmiJS preset' },
  astro: {
    displayName: 'Astro', category: 'framework',
    summary: 'Content-focused web framework with island architecture',
    conventions: ['Use `.astro` components for static content.', 'Use framework islands for interactive parts.'],
    commands: ['astro dev', 'astro build'],
  },

  // ---------- UI libraries ----------
  antd: {
    displayName: 'Ant Design', category: 'ui',
    summary: 'Enterprise-class React UI library',
    conventions: ['Import components individually: `import { Button } from "antd"`.', 'Use ConfigProvider for theming.'],
    constraints: ['Antd 3.x API differs significantly from 4/5 (e.g. `Form.create()` HOC vs `Form.useForm()`).'],
  },
  '@mui/material': {
    displayName: 'Material UI', category: 'ui',
    summary: 'React components implementing Material Design',
    conventions: ['Use `sx` prop for one-off styles.', 'Prefer theme tokens over hardcoded colors.'],
  },
  'element-plus': { displayName: 'Element Plus', category: 'ui', summary: 'Vue 3 component library' },
  'element-ui': { displayName: 'Element UI', category: 'ui', summary: 'Vue 2 component library' },
  '@chakra-ui/react': { displayName: 'Chakra UI', category: 'ui', summary: 'Accessible React component library' },
  'naive-ui': { displayName: 'Naive UI', category: 'ui', summary: 'Vue 3 component library' },
  '@headlessui/react': { displayName: 'Headless UI', category: 'ui', summary: 'Unstyled accessible React components' },
  '@radix-ui/react-dialog': { displayName: 'Radix UI', category: 'ui', summary: 'Low-level accessible React primitives' },
  'shadcn-ui': { displayName: 'shadcn/ui', category: 'ui', summary: 'Copy-paste components built on Radix' },

  // ---------- State management ----------
  zustand: {
    displayName: 'Zustand', category: 'state',
    summary: 'Lightweight React state management',
    conventions: ['Keep stores small and focused.', 'Use selectors to subscribe to specific slices.', 'Derive computed values instead of storing them.'],
  },
  redux: { displayName: 'Redux', category: 'state', summary: 'Predictable state container' },
  '@reduxjs/toolkit': {
    displayName: 'Redux Toolkit', category: 'state',
    summary: 'Official opinionated Redux toolset',
    conventions: ['Use `createSlice` for reducers.', 'Use RTK Query for server state.', 'Avoid storing derived data.'],
  },
  mobx: {
    displayName: 'MobX', category: 'state',
    summary: 'Simple, scalable reactive state management',
    conventions: ['Use `makeAutoObservable` in stores.', 'Keep each store focused on a single domain.'],
  },
  'mobx-react-lite': { displayName: 'MobX React', category: 'state', summary: 'MobX bindings for React' },
  pinia: {
    displayName: 'Pinia', category: 'state',
    summary: 'Official Vue state management',
    conventions: ['Use `defineStore` with setup syntax.', 'Prefer composition stores over options.'],
  },
  jotai: {
    displayName: 'Jotai', category: 'state',
    summary: 'Atom-based React state',
    conventions: ['Create small atoms for each piece of state.', 'Derive state via computed atoms.'],
  },
  recoil: { displayName: 'Recoil', category: 'state', summary: 'Experimental atom-based React state' },
  valtio: { displayName: 'Valtio', category: 'state', summary: 'Proxy-based React state' },
  '@tanstack/react-query': {
    displayName: 'TanStack Query', category: 'state',
    summary: 'Async server state for React',
    conventions: ['Use for server state only — not a client-state replacement.', 'Configure `staleTime` to limit refetches.'],
  },
  swr: { displayName: 'SWR', category: 'state', summary: 'React hooks for data fetching' },
  dva: {
    displayName: 'DVA', category: 'state',
    summary: 'Redux + redux-saga framework',
    conventions: ['Use models for state, reducers, and effects.', 'Follow namespace conventions.'],
  },
  'redux-persist': {
    displayName: 'Redux Persist', category: 'state',
    summary: 'Persist and rehydrate a Redux store',
    conventions: ['Whitelist/blacklist reducers explicitly — avoid persisting volatile state.', 'Wrap the app in `PersistGate` to defer render until rehydration.'],
  },
  '@zstack/connected-react-router': {
    displayName: 'Connected React Router', category: 'state', variant: 'Router/Redux bridge',
    summary: 'Syncs React Router state into the Redux store',
    conventions: ['Dispatch navigation via `push`/`replace` from `connected-react-router`.', 'Keep router state read-only in reducers.'],
  },

  // ---------- Routing ----------
  'react-router-dom': {
    displayName: 'React Router', category: 'framework', variant: 'Routing',
    summary: 'Declarative routing for React',
    conventions: ['Define routes declaratively; prefer data routers on v6.4+.'],
    constraints: ['v5 API (`Switch`, `useHistory`, `component={}`) differs from v6 (`Routes`, `useNavigate`, `element={}`).'],
  },
  'react-router': {
    displayName: 'React Router', category: 'framework', variant: 'Routing',
    summary: 'Core routing library for React',
    constraints: ['v5 and v6 APIs are incompatible — confirm the major version before editing routes.'],
  },

  // ---------- Build tools ----------
  webpack: { displayName: 'Webpack', category: 'build', summary: 'Module bundler' },
  vite: { displayName: 'Vite', category: 'build', summary: 'Fast dev server and build tool', commands: ['vite', 'vite build', 'vite preview'] },
  rollup: { displayName: 'Rollup', category: 'build', summary: 'ES module bundler', commands: ['rollup -c'] },
  esbuild: { displayName: 'esbuild', category: 'build', summary: 'Extremely fast JS bundler' },
  turbopack: { displayName: 'Turbopack', category: 'build', summary: 'Incremental Rust bundler for Next.js' },
  tsup: { displayName: 'tsup', category: 'build', summary: 'TypeScript library bundler (esbuild)', commands: ['tsup'] },
  '@rsbuild/core': { displayName: 'Rsbuild', category: 'build', summary: 'Rspack-based build tool', commands: ['rsbuild dev', 'rsbuild build'] },
  parcel: { displayName: 'Parcel', category: 'build', summary: 'Zero-config web bundler' },
  '@swc/core': { displayName: 'SWC', category: 'build', summary: 'Rust-based JS/TS compiler' },
  '@module-federation/rsbuild-plugin': {
    displayName: 'Module Federation', category: 'framework', variant: 'Micro-frontend',
    summary: 'Runtime module sharing across independently-built apps',
    conventions: [
      'Declare exposes/remotes and shared deps in the MF plugin config.',
      'Keep shared singletons (react, react-dom) aligned across host and remotes.',
      'Load remotes at runtime; do not import remote internals directly.',
    ],
    constraints: ['Host and remotes must agree on shared dependency versions or runtime errors occur.'],
  },
  '@module-federation/enhanced': {
    displayName: 'Module Federation', category: 'framework', variant: 'Micro-frontend',
    summary: 'Module Federation runtime/build enhancements',
    constraints: ['Keep shared singletons aligned across host and remotes.'],
  },
  '@module-federation/runtime': {
    displayName: 'Module Federation Runtime', category: 'framework', variant: 'Micro-frontend',
    summary: 'Runtime API for loading federated remotes',
  },

  // ---------- Testing ----------
  vitest: {
    displayName: 'Vitest', category: 'testing',
    summary: 'Vite-native testing framework',
    conventions: ['Test files: `*.test.ts` or `*.spec.ts`.', 'Use `describe` / `it` / `expect` pattern.', 'Use `vi.mock()` for mocking.'],
    commands: ['vitest', 'vitest run', 'vitest --coverage'],
  },
  jest: {
    displayName: 'Jest', category: 'testing',
    summary: 'JavaScript testing framework by Meta',
    conventions: ['Test files: `*.test.ts` or `*.spec.ts`.', 'Use `describe` / `it` / `expect` pattern.', 'Use `jest.mock()` for mocking.'],
    commands: ['jest', 'jest --coverage'],
  },
  '@testing-library/react': {
    displayName: 'Testing Library', category: 'testing',
    summary: 'Test React components by user behavior',
    conventions: ['Query by role/label/text — avoid test IDs unless necessary.', 'Use `screen` for queries.', 'Test behavior, not implementation details.'],
  },
  '@playwright/test': {
    displayName: 'Playwright', category: 'testing',
    summary: 'End-to-end testing for modern web apps',
    conventions: ['Use page objects for complex flows.', 'Prefer `getByRole` / `getByText` over CSS selectors.'],
    commands: ['npx playwright test', 'npx playwright test --ui'],
  },
  playwright: { displayName: 'Playwright', category: 'testing', summary: 'End-to-end testing', commands: ['npx playwright test'] },
  cypress: { displayName: 'Cypress', category: 'testing', summary: 'E2E and component testing', commands: ['npx cypress open', 'npx cypress run'] },
  mocha: { displayName: 'Mocha', category: 'testing', summary: 'Flexible JavaScript test framework' },

  // ---------- Styling ----------
  tailwindcss: {
    displayName: 'Tailwind CSS', category: 'styling',
    summary: 'Utility-first CSS framework',
    conventions: ['Use utility classes in markup.', 'Extract repeating patterns as components, not custom CSS.', 'Use `@apply` sparingly.'],
  },
  'styled-components': {
    displayName: 'styled-components', category: 'styling',
    summary: 'CSS-in-JS for React using tagged templates',
    conventions: ['Colocate styled components with their React component.', 'Use a theme provider for design tokens.'],
  },
  '@emotion/react': { displayName: 'Emotion', category: 'styling', summary: 'High-performance CSS-in-JS' },
  sass: { displayName: 'Sass', category: 'styling', summary: 'CSS preprocessor with nesting and variables' },
  less: { displayName: 'Less', category: 'styling', summary: 'CSS preprocessor' },
  '@vanilla-extract/css': { displayName: 'Vanilla Extract', category: 'styling', summary: 'Zero-runtime CSS-in-TypeScript' },

  // ---------- Databases ----------
  prisma: {
    displayName: 'Prisma', category: 'database',
    summary: 'Type-safe Node.js ORM',
    conventions: ['Keep schema in `prisma/schema.prisma`.', 'Prefer Prisma Client over raw SQL.'],
    commands: ['npx prisma generate', 'npx prisma migrate dev', 'npx prisma studio'],
  },
  '@prisma/client': { displayName: 'Prisma', category: 'database', summary: 'Type-safe Node.js ORM' },
  typeorm: {
    displayName: 'TypeORM', category: 'database',
    summary: 'TypeScript ORM for SQL databases',
    conventions: ['Use decorators for entity definitions.', 'Prefer query builder over raw SQL.'],
  },
  mongoose: { displayName: 'Mongoose', category: 'database', summary: 'MongoDB ODM for Node.js' },
  'drizzle-orm': { displayName: 'Drizzle', category: 'database', summary: 'TypeScript ORM with SQL-like query builder' },
  knex: { displayName: 'Knex', category: 'database', summary: 'SQL query builder for Node.js' },
  ioredis: { displayName: 'Redis (ioredis)', category: 'database', summary: 'Redis client for Node.js' },
  redis: { displayName: 'Redis', category: 'database', summary: 'Redis client' },

  // ---------- Dev tools ----------
  eslint: { displayName: 'ESLint', category: 'devtool', summary: 'JavaScript/TypeScript linter', commands: ['eslint .', 'eslint --fix .'] },
  prettier: { displayName: 'Prettier', category: 'devtool', summary: 'Opinionated code formatter', commands: ['prettier --write .'] },
  typescript: { displayName: 'TypeScript (dep)', category: 'devtool', summary: 'TypeScript compiler dependency', commands: ['tsc --noEmit'] },
  '@storybook/react': { displayName: 'Storybook', category: 'devtool', summary: 'UI component development environment', commands: ['storybook dev', 'storybook build'] },
}

export const nodeKnowledge = createEcosystemProvider('static:node', 'node', TABLE)
