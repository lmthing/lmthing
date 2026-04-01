import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { applyFileWrite, applyFileDiff } from './file-block-applier'
import { createReadLedger, recordRead } from '../sandbox/read-ledger'

// ── Test fixture directory ────────────────────────────────────────────────────

let workingDir: string

beforeAll(async () => {
  workingDir = await mkdtemp(join(tmpdir(), 'lmthing-file-block-test-'))
})

afterAll(async () => {
  await rm(workingDir, { recursive: true, force: true })
})

// ── applyFileWrite ────────────────────────────────────────────────────────────

describe('applyFileWrite', () => {
  it('creates a new file with given content', async () => {
    const ledger = createReadLedger()
    const result = await applyFileWrite('hello.txt', 'Hello, world!\n', workingDir, ledger)
    expect(result.ok).toBe(true)
    const content = await readFile(join(workingDir, 'hello.txt'), 'utf-8')
    expect(content).toBe('Hello, world!\n')
  })

  it('overwrites an existing file', async () => {
    const ledger = createReadLedger()
    await applyFileWrite('overwrite.txt', 'original\n', workingDir, ledger)
    await applyFileWrite('overwrite.txt', 'updated\n', workingDir, ledger)
    const content = await readFile(join(workingDir, 'overwrite.txt'), 'utf-8')
    expect(content).toBe('updated\n')
  })

  it('creates parent directories recursively', async () => {
    const ledger = createReadLedger()
    const result = await applyFileWrite('deep/nested/dir/file.ts', 'export {}', workingDir, ledger)
    expect(result.ok).toBe(true)
    const content = await readFile(join(workingDir, 'deep/nested/dir/file.ts'), 'utf-8')
    expect(content).toBe('export {}')
  })

  it('records the file in the read ledger after writing', async () => {
    const ledger = createReadLedger()
    await applyFileWrite('ledger-test.ts', 'const x = 1', workingDir, ledger)
    const resolvedPath = join(workingDir, 'ledger-test.ts')
    expect(ledger.paths.has(resolvedPath)).toBe(true)
  })

  it('blocks path traversal (../outside)', async () => {
    const ledger = createReadLedger()
    const result = await applyFileWrite('../escape.txt', 'evil', workingDir, ledger)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('traversal')
    }
  })

  it('blocks absolute paths outside working directory', async () => {
    const ledger = createReadLedger()
    const result = await applyFileWrite('/tmp/evil.txt', 'evil', workingDir, ledger)
    expect(result.ok).toBe(false)
  })
})

// ── applyFileDiff ─────────────────────────────────────────────────────────────

describe('applyFileDiff', () => {
  it('applies a valid unified diff to an existing file', async () => {
    const ledger = createReadLedger()
    const filePath = join(workingDir, 'patch-me.ts')
    await writeFile(filePath, 'const x = 1\nconst y = 2\nconst z = 3\n')
    recordRead(ledger, filePath)

    const diff = `--- a/patch-me.ts
+++ b/patch-me.ts
@@ -1,3 +1,3 @@
 const x = 1
-const y = 2
+const y = 99
 const z = 3`

    const result = await applyFileDiff('patch-me.ts', diff, workingDir, ledger)
    expect(result.ok).toBe(true)
    const content = await readFile(filePath, 'utf-8')
    expect(content).toContain('const y = 99')
    expect(content).not.toContain('const y = 2')
  })

  it('preserves trailing newline if original had one', async () => {
    const ledger = createReadLedger()
    const filePath = join(workingDir, 'trailing-nl.ts')
    await writeFile(filePath, 'line one\nline two\n')
    recordRead(ledger, filePath)

    const diff = `@@ -1,2 +1,2 @@
-line one
+line ONE
 line two`

    const result = await applyFileDiff('trailing-nl.ts', diff, workingDir, ledger)
    expect(result.ok).toBe(true)
    const content = await readFile(filePath, 'utf-8')
    expect(content.endsWith('\n')).toBe(true)
  })

  it('returns error if file not in read ledger', async () => {
    const ledger = createReadLedger()
    const filePath = join(workingDir, 'unread.ts')
    await writeFile(filePath, 'const a = 1\n')
    // Do NOT call recordRead

    const diff = `@@ -1,1 +1,1 @@
-const a = 1
+const a = 2`

    const result = await applyFileDiff('unread.ts', diff, workingDir, ledger)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('has not been read')
    }
  })

  it('returns error if file does not exist', async () => {
    const ledger = createReadLedger()
    const filePath = join(workingDir, 'nonexistent.ts')
    recordRead(ledger, filePath) // mark as read but file doesn't exist

    const diff = `@@ -1,1 +1,1 @@
-old
+new`

    const result = await applyFileDiff('nonexistent.ts', diff, workingDir, ledger)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('nonexistent.ts')
    }
  })

  it('returns error if hunk context does not match', async () => {
    const ledger = createReadLedger()
    const filePath = join(workingDir, 'mismatch.ts')
    await writeFile(filePath, 'line A\nline B\n')
    recordRead(ledger, filePath)

    const diff = `@@ -1,2 +1,2 @@
-wrong context
+new context
 line B`

    const result = await applyFileDiff('mismatch.ts', diff, workingDir, ledger)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('context mismatch')
    }
  })

  it('returns error when no valid hunks found', async () => {
    const ledger = createReadLedger()
    const filePath = join(workingDir, 'no-hunks.ts')
    await writeFile(filePath, 'content\n')
    recordRead(ledger, filePath)

    const result = await applyFileDiff('no-hunks.ts', 'This is not a diff at all.', workingDir, ledger)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('No valid hunks')
    }
  })

  it('blocks path traversal in diff', async () => {
    const ledger = createReadLedger()
    const result = await applyFileDiff('../evil.ts', '@@ -1,1 +1,1 @@\n-x\n+y', workingDir, ledger)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('traversal')
    }
  })

  it('applies multiple hunks in sequence', async () => {
    const ledger = createReadLedger()
    const filePath = join(workingDir, 'multi-hunk.ts')
    await writeFile(filePath, 'line 1\nline 2\nline 3\nline 4\nline 5\n')
    recordRead(ledger, filePath)

    const diff = `@@ -1,2 +1,2 @@
-line 1
+LINE 1
 line 2
@@ -4,2 +4,2 @@
 line 4
-line 5
+LINE 5`

    const result = await applyFileDiff('multi-hunk.ts', diff, workingDir, ledger)
    expect(result.ok).toBe(true)
    const content = await readFile(filePath, 'utf-8')
    expect(content).toContain('LINE 1')
    expect(content).toContain('LINE 5')
    expect(content).toContain('line 2')
    expect(content).toContain('line 4')
  })
})
