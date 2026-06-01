import { createEcosystemProvider, type KnowledgeTable } from './_table.js'

const TABLE: KnowledgeTable = {
  // ---------- Frameworks ----------
  flutter: { displayName: 'Flutter', category: 'framework', variant: 'Mobile/Desktop', summary: 'Cross-platform UI toolkit by Google' },
  dart_frog: { displayName: 'Dart Frog', category: 'framework', variant: 'Backend', summary: 'Dart backend framework' },
  serverpod: { displayName: 'Serverpod', category: 'framework', variant: 'Backend', summary: 'Dart backend framework' },

  // ---------- State ----------
  bloc: { displayName: 'BLoC', category: 'state', summary: 'Business logic component pattern' },
  flutter_bloc: { displayName: 'flutter_bloc', category: 'state', summary: 'BLoC pattern implementation for Flutter' },
  provider: { displayName: 'Provider', category: 'state', summary: 'Simple state management for Flutter' },
  riverpod: {
    displayName: 'Riverpod', category: 'state',
    summary: 'Reactive state management for Flutter',
    conventions: ['Use `ref.watch` for reactive rebuilds.', 'Prefer `ConsumerWidget` over `Consumer`.'],
  },
  get: { displayName: 'GetX', category: 'state', summary: 'Lightweight Flutter state management' },

  // ---------- Testing ----------
  flutter_test: {
    displayName: 'Flutter Test', category: 'testing',
    summary: 'Flutter testing library',
    conventions: ['Test files in `test/`, named `*_test.dart`.'],
    commands: ['flutter test'],
  },
  mockito: { displayName: 'Mockito', category: 'testing', summary: 'Mocking for Dart tests' },
  integration_test: { displayName: 'Integration Test', category: 'testing', summary: 'Flutter integration testing' },
}

export const dartKnowledge = createEcosystemProvider('static:dart', 'dart', TABLE)
