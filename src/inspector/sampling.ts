import fs from 'node:fs'
import path from 'node:path'
import type { SampleBucket } from '../types.js'

// ---------------------------------------------------------------------------
// Role-bucket file classification
// ---------------------------------------------------------------------------

/** Per-bucket config: directory names to scan, file-name hints, priority. */
interface BucketDef {
  dirs: string[]
  namePatterns: RegExp[]
}

const BUCKETS: Record<SampleBucket, BucketDef> = {
  pages: { dirs: ['pages', 'routes', 'views', 'screens'], namePatterns: [/page/i, /route/i, /screen/i, /view/i] },
  components: { dirs: ['components', 'ui', 'widgets'], namePatterns: [/component/i] },
  hooks: { dirs: ['hooks', 'composables', 'use'], namePatterns: [/^use[A-Z]/, /hook/i] },
  services: { dirs: ['services', 'utils', 'lib', 'api', 'helpers'], namePatterns: [/service/i, /request/i, /client/i, /api/i, /utils?/i] },
  layouts: { dirs: ['layouts', 'layout', 'templates'], namePatterns: [/layout/i, /template/i] },
  utils: { dirs: ['utils', 'lib', 'helpers', 'shared'], namePatterns: [/util/i, /helper/i, /shared/i] },
}

const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])
const SKIP_PATTERNS = [/\.test\./, /\.spec\./, /__tests__/, /\.d\.ts$/]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SamplingResult {
  /** Files grouped by bucket, deduplicated (a file only appears in one bucket). */
  buckets: Record<SampleBucket, string[]>
  /** All sampled file paths (absolute). */
  all: string[]
}

/**
 * Sample representative files from `srcDir`, classified into role buckets.
 * Caps at `maxFiles` total and `maxBytes` cumulative.
 */
export function sampleFiles(
  projectRoot: string,
  srcDir: string,
  globs: string[],
  maxFiles = 16,
  maxBytes = 80_000,
): SamplingResult {
  const base = path.join(projectRoot, srcDir)
  if (!fs.existsSync(base)) return emptyResult()

  const candidates = collectFiles(base, projectRoot, maxFiles * 4)
  const buckets = assignBuckets(candidates)
  return trimBuckets(buckets, projectRoot, maxFiles, maxBytes)
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function emptyResult(): SamplingResult {
  return { buckets: { pages: [], components: [], hooks: [], services: [], layouts: [], utils: [] }, all: [] }
}

function isSourceFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase()
  if (!FILE_EXTS.has(ext)) return false
  if (SKIP_PATTERNS.some(p => p.test(name))) return false
  return true
}

/** Collect source files recursively, capped at `limit`. Returns paths relative to projectRoot. */
function collectFiles(base: string, projectRoot: string, limit: number): string[] {
  const out: string[] = []
  walk(base, projectRoot, out, limit)
  return out
}

function walk(dir: string, projectRoot: string, out: string[], limit: number): void {
  if (out.length >= limit) return
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }

  for (const entry of entries) {
    if (out.length >= limit) return
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, projectRoot, out, limit)
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      // Store path relative to projectRoot so scoreBucket can match parent dirs
      out.push(path.relative(projectRoot, full).replace(/\\/g, '/'))
    }
  }
}

/** Score a file for a bucket. Higher = better fit. Path is relative to projectRoot. */
function scoreBucket(relPath: string, def: BucketDef): number {
  let score = 0
  for (const dir of def.dirs) {
    if (relPath.includes(`/${dir}/`) || relPath.startsWith(`${dir}/`) || relPath === dir) {
      score += 3
    }
  }
  for (const pat of def.namePatterns) {
    if (pat.test(path.basename(relPath))) score += 2
  }
  return score
}

/** Assign each file to at most one bucket. */
function assignBuckets(files: string[]): Record<SampleBucket, string[]> {
  const buckets: Record<SampleBucket, string[]> = {
    pages: [], components: [], hooks: [], services: [], layouts: [], utils: [],
  }
  const assigned = new Set<string>()

  for (const file of files) {
    let bestBucket: SampleBucket | null = null
    let bestScore = 0

    for (const [bucket, def] of Object.entries(BUCKETS) as [SampleBucket, BucketDef][]) {
      const s = scoreBucket(file, def)
      if (s > bestScore) { bestScore = s; bestBucket = bucket }
    }

    if (bestBucket && !assigned.has(file)) {
      buckets[bestBucket].push(file)
      assigned.add(file)
    } else if (!bestBucket) {
      buckets.services.push(file)
      assigned.add(file)
    }
  }

  return buckets
}

/** Trim per-bucket and total caps. */
function trimBuckets(
  buckets: Record<SampleBucket, string[]>,
  projectRoot: string,
  maxFiles: number,
  maxBytes: number,
): SamplingResult {
  const result = emptyResult()
  let totalBytes = 0
  const maxPerBucket = Math.max(3, Math.ceil(maxFiles / 4))

  for (const [bucket, files] of Object.entries(buckets) as [SampleBucket, string[]][]) {
    for (const file of files) {
      if (result.all.length >= maxFiles || totalBytes >= maxBytes) break
      if (result.buckets[bucket].length >= maxPerBucket) break
      try {
        const size = fs.statSync(path.join(projectRoot, file)).size
        if (totalBytes + size > maxBytes) continue
        totalBytes += size
        result.buckets[bucket].push(file)
        result.all.push(file)
      } catch { /* inaccessible file */ }
    }
  }

  return result
}
