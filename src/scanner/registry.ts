import type { ScannerPlugin } from '../types.js'

import { nodeScanner } from './plugins/node.js'
import { pythonScanner } from './plugins/python.js'
import { goScanner } from './plugins/go.js'
import { rustScanner } from './plugins/rust.js'
import { dartScanner } from './plugins/dart.js'
import { genericScanner } from './plugins/generic.js'

/**
 * Scanner plugin registry. Each plugin owns parsing of one ecosystem
 * and emits raw deps + project signals. Order matters only for
 * tie-breaking; see scanner/index.ts for the merge strategy.
 *
 * Adding a new ecosystem:
 *   1. Create `scanner/plugins/<eco>.ts` implementing `ScannerPlugin`
 *   2. Add it to the array below
 */
export const scannerPlugins: ScannerPlugin[] = [
  nodeScanner,
  pythonScanner,
  goScanner,
  rustScanner,
  dartScanner,
  genericScanner,
]
