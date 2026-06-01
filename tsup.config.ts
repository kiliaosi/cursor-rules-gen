import { defineConfig } from 'tsup'

export default defineConfig([
  // CLI — ESM with shebang
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    target: 'node18',
    outExtension: () => ({ js: '.mjs' }),
    clean: true,
    dts: false,
    banner: { js: '#!/usr/bin/env node' },
  },
  // VSCode/Cursor extension — CJS, `vscode` is provided by the host
  {
    entry: { extension: 'src/extension/extension.ts' },
    format: ['cjs'],
    target: 'node18',
    outExtension: () => ({ js: '.cjs' }),
    dts: false,
    external: ['vscode'],
  },
])
