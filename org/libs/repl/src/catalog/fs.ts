import * as nodeFs from 'node:fs/promises'
import * as nodePath from 'node:path'
import { glob as nodeGlob } from 'node:fs/promises'
import type { CatalogModule } from './types'
import type { ReadLedger } from '../sandbox/read-ledger'
import { recordRead } from '../sandbox/read-ledger'

let workingDir = process.cwd()
let activeLedger: ReadLedger | null = null

export function setWorkingDir(dir: string): void {
  workingDir = dir
}

export function setReadLedger(ledger: ReadLedger): void {
  activeLedger = ledger
}

function safePath(p: string): string {
  const resolved = nodePath.resolve(workingDir, p)
  if (!resolved.startsWith(workingDir)) {
    throw new Error(`Path traversal blocked: ${p} resolves outside working directory`)
  }
  return resolved
}

const fsModule: CatalogModule = {
  id: 'fs',
  description: 'File system operations',
  functions: [
    {
      name: 'readFile',
      description: 'Read file contents',
      signature: '(path: string, encoding?: string) => Promise<string>',
      fn: async (path: unknown, encoding?: unknown) => {
        const resolved = safePath(path as string)
        const content = await nodeFs.readFile(resolved, (encoding as BufferEncoding) || 'utf-8')
        if (activeLedger) recordRead(activeLedger, resolved)
        return content
      },
    },
    {
      name: 'writeFile',
      description: 'Write content to file',
      signature: '(path: string, content: string) => Promise<void>',
      fn: async (path: unknown, content: unknown) => {
        await nodeFs.writeFile(safePath(path as string), content as string, 'utf-8')
      },
    },
    {
      name: 'appendFile',
      description: 'Append to file',
      signature: '(path: string, content: string) => Promise<void>',
      fn: async (path: unknown, content: unknown) => {
        await nodeFs.appendFile(safePath(path as string), content as string, 'utf-8')
      },
    },
    {
      name: 'listDir',
      description: 'List directory entries',
      signature: '(path: string, options?: { recursive?: boolean }) => Promise<string[]>',
      fn: async (path: unknown, options?: unknown) => {
        const opts = options as { recursive?: boolean } | undefined
        const entries = await nodeFs.readdir(safePath(path as string), { recursive: opts?.recursive })
        return entries.map(String)
      },
    },
    {
      name: 'glob',
      description: 'Glob pattern match',
      signature: '(pattern: string, cwd?: string) => Promise<string[]>',
      fn: async (pattern: unknown, cwd?: unknown) => {
        const dir = cwd ? safePath(cwd as string) : workingDir
        const results: string[] = []
        for await (const entry of nodeGlob(pattern as string, { cwd: dir })) {
          results.push(entry)
        }
        return results
      },
    },
    {
      name: 'stat',
      description: 'File metadata',
      signature: '(path: string) => Promise<{ size: number, modified: string, isDir: boolean }>',
      fn: async (path: unknown) => {
        const stats = await nodeFs.stat(safePath(path as string))
        return { size: stats.size, modified: stats.mtime.toISOString(), isDir: stats.isDirectory() }
      },
    },
    {
      name: 'exists',
      description: 'Check if path exists',
      signature: '(path: string) => Promise<boolean>',
      fn: async (path: unknown) => {
        try { await nodeFs.access(safePath(path as string)); return true }
        catch { return false }
      },
    },
    {
      name: 'mkdir',
      description: 'Create directory (recursive)',
      signature: '(path: string) => Promise<void>',
      fn: async (path: unknown) => {
        await nodeFs.mkdir(safePath(path as string), { recursive: true })
      },
    },
    {
      name: 'remove',
      description: 'Delete file or directory',
      signature: '(path: string) => Promise<void>',
      fn: async (path: unknown) => {
        await nodeFs.rm(safePath(path as string), { recursive: true, force: true })
      },
    },
    {
      name: 'copy',
      description: 'Copy file or directory',
      signature: '(src: string, dest: string) => Promise<void>',
      fn: async (src: unknown, dest: unknown) => {
        await nodeFs.cp(safePath(src as string), safePath(dest as string), { recursive: true })
      },
    },
    {
      name: 'move',
      description: 'Move/rename file or directory',
      signature: '(src: string, dest: string) => Promise<void>',
      fn: async (src: unknown, dest: unknown) => {
        await nodeFs.rename(safePath(src as string), safePath(dest as string))
      },
    },
  ],
}

export default fsModule
