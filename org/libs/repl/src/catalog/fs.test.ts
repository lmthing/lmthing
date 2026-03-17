import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fsModule from './fs'
import { setWorkingDir } from './fs'

describe('catalog/fs', () => {
  const fns = Object.fromEntries(fsModule.functions.map(f => [f.name, f.fn]))
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'repl-test-'))
    setWorkingDir(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('readFile reads file contents', async () => {
    await writeFile(join(tempDir, 'test.txt'), 'hello')
    expect(await fns.readFile('test.txt')).toBe('hello')
  })

  it('writeFile creates a file', async () => {
    await fns.writeFile('out.txt', 'world')
    expect(await readFile(join(tempDir, 'out.txt'), 'utf-8')).toBe('world')
  })

  it('exists returns true for existing files', async () => {
    await writeFile(join(tempDir, 'test.txt'), '')
    expect(await fns.exists('test.txt')).toBe(true)
    expect(await fns.exists('nope.txt')).toBe(false)
  })

  it('stat returns file metadata', async () => {
    await writeFile(join(tempDir, 'test.txt'), 'hello')
    const s = await fns.stat('test.txt') as any
    expect(s.size).toBe(5)
    expect(s.isDir).toBe(false)
  })

  it('blocks path traversal', async () => {
    await expect(fns.readFile('../../etc/passwd')).rejects.toThrow('Path traversal blocked')
  })

  it('mkdir creates directories', async () => {
    await fns.mkdir('sub/dir')
    expect(await fns.exists('sub/dir')).toBe(true)
  })

  it('remove deletes files', async () => {
    await writeFile(join(tempDir, 'del.txt'), '')
    await fns.remove('del.txt')
    expect(await fns.exists('del.txt')).toBe(false)
  })

  it('copy copies files', async () => {
    await writeFile(join(tempDir, 'src.txt'), 'data')
    await fns.copy('src.txt', 'dst.txt')
    expect(await readFile(join(tempDir, 'dst.txt'), 'utf-8')).toBe('data')
  })
})
