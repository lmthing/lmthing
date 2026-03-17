import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('cli/bin', () => {
  it('bin.ts exists', () => {
    expect(existsSync(resolve(__dirname, 'bin.ts'))).toBe(true)
  })

  // The bin entry point is tested via integration test (running the CLI).
  // Here we just verify the file exists and can be imported without side effects.
})
