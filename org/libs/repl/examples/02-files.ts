/**
 * Example 2: File explorer
 *
 * The agent gets file system functions and explores the current directory.
 * Demonstrates: async operations, stop() with complex data, multi-step exploration.
 *
 * Run:
 *   OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_MODEL=qwen2.5-coder npx tsx examples/02-files.ts
 *   OPENAI_API_KEY=sk-... npx tsx examples/02-files.ts
 */

import { runRepl } from './runner'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

// ── Functions the agent can call ──

const workDir = process.cwd()

async function listFiles(dir: string = '.'): Promise<string[]> {
  const fullPath = join(workDir, dir)
  const entries = await readdir(fullPath)
  return entries.filter(e => !e.startsWith('.'))
}

async function readTextFile(path: string): Promise<string> {
  const fullPath = join(workDir, path)
  return readFile(fullPath, 'utf-8')
}

async function fileInfo(path: string): Promise<{ size: number; modified: string; isDir: boolean }> {
  const fullPath = join(workDir, path)
  const s = await stat(fullPath)
  return {
    size: s.size,
    modified: s.mtime.toISOString(),
    isDir: s.isDirectory(),
  }
}

async function countLines(path: string): Promise<number> {
  const content = await readTextFile(path)
  return content.split('\n').length
}

function getExtension(path: string): string {
  return extname(path)
}

// ── Run ──

await runRepl({
  userMessage: 'List the files in the current directory. Find the package.json, read it, and tell me the package name and version. Also count how many .ts files are in the src/ directory.',
  globals: { listFiles, readTextFile, fileInfo, countLines, getExtension },
  functionSignatures: `
  listFiles(dir?: string): Promise<string[]> — List files in a directory (relative to cwd, excludes dotfiles)
  readTextFile(path: string): Promise<string> — Read a file as UTF-8 text
  fileInfo(path: string): Promise<{ size: number, modified: string, isDir: boolean }> — Get file metadata
  countLines(path: string): Promise<number> — Count lines in a text file
  getExtension(path: string): string — Get file extension (e.g. ".ts")
  `,
})
