import { spawnSync } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Recursively collect *.test.ts / *.test.tsx files under dir. */
function collectTestFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(full))
    } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
      files.push(full)
    }
  }
  return files
}

/** Walk up from startDir to find the nearest node_modules/.bin/vitest. */
function findVitestBin(): string {
  let dir = __dirname
  while (true) {
    const candidate = join(dir, 'node_modules', '.bin', 'vitest')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return 'vitest'
}

/** Walk up from startDir to find the nearest pnpm-workspace.yaml (monorepo root). */
function findMonorepoRoot(): string | null {
  let dir = __dirname
  while (true) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

export interface RunSpaceTestsOptions {
  pattern?: string
  model?: string
}

/**
 * Discover all *.test.ts files in the given space directories and run them
 * with vitest. Returns the vitest process exit code.
 */
export function runSpaceTests(spacePaths: string[], options: RunSpaceTestsOptions = {}): number {
  const testFiles: string[] = []

  for (const spacePath of spacePaths) {
    const abs = resolve(spacePath)
    const found = collectTestFiles(abs)
    testFiles.push(...found)
  }

  if (testFiles.length === 0) {
    console.log('No test files found in the specified space(s).')
    for (const sp of spacePaths) console.log(`  Searched: ${resolve(sp)}`)
    return 0
  }

  console.log(`\n\x1b[36m━━━ lmthing test ━━━\x1b[0m`)
  console.log(`\x1b[90mFound ${testFiles.length} test file(s):\x1b[0m`)
  for (const f of testFiles) console.log(`\x1b[90m  ${f}\x1b[0m`)
  console.log()

  const vitestBin = findVitestBin()
  const cwd = findMonorepoRoot() ?? process.cwd()

  // Forward all current env vars so API keys and model aliases are available
  const env: NodeJS.ProcessEnv = { ...process.env }

  const result = spawnSync(vitestBin, ['run', '--reporter', 'verbose', ...testFiles], {
    cwd,
    env,
    stdio: 'inherit',
  })

  return result.status ?? 1
}
