import * as nodeFs from 'node:fs/promises'
import * as nodePath from 'node:path'
import type { ReadLedger } from '../sandbox/read-ledger'
import { hasBeenRead, recordRead } from '../sandbox/read-ledger'

export type ApplyResult =
  | { ok: true }
  | { ok: false; error: string }

// ── Path safety ──

function makeSafePath(workingDir: string) {
  return (p: string): string => {
    const resolved = nodePath.resolve(workingDir, p)
    if (!resolved.startsWith(workingDir + nodePath.sep) && resolved !== workingDir) {
      throw new Error(`Path traversal blocked: ${p} resolves outside working directory`)
    }
    return resolved
  }
}

// ── Unified diff parser ──

interface Hunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: Array<{ op: ' ' | '-' | '+'; text: string }>
}

function parseHunks(diffContent: string): Hunk[] {
  const lines = diffContent.split('\n')
  const hunks: Hunk[] = []
  let i = 0

  // Skip --- / +++ header lines
  while (i < lines.length && !lines[i].startsWith('@@')) i++

  while (i < lines.length) {
    const line = lines[i]
    if (!line.startsWith('@@')) {
      i++
      continue
    }

    const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
    if (!match) {
      i++
      continue
    }

    const oldStart = parseInt(match[1], 10)
    const oldCount = match[2] !== undefined ? parseInt(match[2], 10) : 1
    const newStart = parseInt(match[3], 10)
    const newCount = match[4] !== undefined ? parseInt(match[4], 10) : 1

    i++
    const hunkLines: Hunk['lines'] = []

    while (i < lines.length && !lines[i].startsWith('@@')) {
      const l = lines[i]
      if (l.startsWith('-')) {
        hunkLines.push({ op: '-', text: l.slice(1) })
      } else if (l.startsWith('+')) {
        hunkLines.push({ op: '+', text: l.slice(1) })
      } else if (l.startsWith(' ')) {
        hunkLines.push({ op: ' ', text: l.slice(1) })
      } else if (l.startsWith('\\')) {
        // "\ No newline at end of file" — skip
      } else if (l === '' || l.startsWith('diff ') || l.startsWith('---') || l.startsWith('+++')) {
        break
      }
      i++
    }

    hunks.push({ oldStart, oldCount, newStart, newCount, lines: hunkLines })
  }

  return hunks
}

function applyHunksToContent(fileContent: string, hunks: Hunk[]): { ok: true; content: string } | { ok: false; error: string } {
  const hadTrailingNewline = fileContent.endsWith('\n')
  const fileLines = fileContent.split('\n')
  if (hadTrailingNewline && fileLines[fileLines.length - 1] === '') {
    fileLines.pop()
  }

  const result = [...fileLines]
  let offset = 0

  for (const hunk of hunks) {
    const startIdx = hunk.oldStart - 1 + offset

    const expectedOldLines = hunk.lines
      .filter(l => l.op === ' ' || l.op === '-')
      .map(l => l.text)

    for (let j = 0; j < expectedOldLines.length; j++) {
      const fileIdx = startIdx + j
      const fileLine = result[fileIdx]
      if (fileLine !== expectedOldLines[j]) {
        return {
          ok: false,
          error:
            `Hunk @@ -${hunk.oldStart},${hunk.oldCount} @@: context mismatch at line ${hunk.oldStart + j}.` +
            ` Expected ${JSON.stringify(expectedOldLines[j])}, got ${fileLine === undefined ? '<EOF>' : JSON.stringify(fileLine)}`,
        }
      }
    }

    const newLines = hunk.lines
      .filter(l => l.op === ' ' || l.op === '+')
      .map(l => l.text)

    result.splice(startIdx, expectedOldLines.length, ...newLines)
    offset += newLines.length - expectedOldLines.length
  }

  const content = result.join('\n') + (hadTrailingNewline ? '\n' : '')
  return { ok: true, content }
}

// ── Public API ──

export async function applyFileWrite(
  filePath: string,
  content: string,
  workingDir: string,
  ledger: ReadLedger,
): Promise<ApplyResult> {
  const safePath = makeSafePath(workingDir)
  let resolved: string
  try {
    resolved = safePath(filePath)
  } catch (err: any) {
    return { ok: false, error: err.message }
  }

  // Ensure parent directory exists
  await nodeFs.mkdir(nodePath.dirname(resolved), { recursive: true })
  await nodeFs.writeFile(resolved, content, 'utf-8')

  // Writing implicitly "reads" the file (agent knows what it wrote)
  recordRead(ledger, resolved)

  return { ok: true }
}

export async function applyFileDiff(
  filePath: string,
  diffContent: string,
  workingDir: string,
  ledger: ReadLedger,
): Promise<ApplyResult> {
  const safePath = makeSafePath(workingDir)
  let resolved: string
  try {
    resolved = safePath(filePath)
  } catch (err: any) {
    return { ok: false, error: err.message }
  }

  if (!hasBeenRead(ledger, resolved)) {
    return {
      ok: false,
      error: `File '${filePath}' has not been read this session. Call readFile('${filePath}') before patching.`,
    }
  }

  let existing: string
  try {
    existing = await nodeFs.readFile(resolved, 'utf-8')
  } catch {
    return { ok: false, error: `Cannot read '${filePath}': file does not exist or is not readable.` }
  }

  const hunks = parseHunks(diffContent)
  if (hunks.length === 0) {
    return { ok: false, error: `No valid hunks found in diff for '${filePath}'.` }
  }

  const result = applyHunksToContent(existing, hunks)
  if (!result.ok) {
    return result
  }

  await nodeFs.writeFile(resolved, result.content, 'utf-8')
  return { ok: true }
}
