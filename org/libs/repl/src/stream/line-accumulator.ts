import { createBracketState, feedChunk, isBalanced, resetBracketState, type BracketState } from './bracket-tracker'
import { isCompleteStatement } from '../parser/statement-detector'

// ── Statement types ──

export type Statement =
  | { type: 'code'; source: string }
  | { type: 'file_write'; path: string; content: string }
  | { type: 'file_diff'; path: string; diff: string }

export type FileBlockStatement = Extract<Statement, { type: 'file_write' | 'file_diff' }>

type AccumulatorMode = 'typescript' | 'file_block_header' | 'file_write' | 'file_diff'

// ── Accumulator ──

export interface LineAccumulator {
  buffer: string
  bracketState: BracketState
  mode: AccumulatorMode
  /** Backticks seen consecutively when buffer is all-whitespace (potential file block start). */
  pendingBackticks: number
  fileBlockHeader: string
  fileBlockPath: string
  fileBlockContent: string
  fileBlockCurrentLine: string
}

export function createLineAccumulator(): LineAccumulator {
  return {
    buffer: '',
    bracketState: createBracketState(),
    mode: 'typescript',
    pendingBackticks: 0,
    fileBlockHeader: '',
    fileBlockPath: '',
    fileBlockContent: '',
    fileBlockCurrentLine: '',
  }
}

export interface FeedResult {
  /** Complete statements (code or file blocks) that were flushed */
  statements: Statement[]
  /** Whether there's still content in the buffer */
  hasRemaining: boolean
}

/**
 * Feed a token (chunk of text) into the accumulator.
 * Returns any complete statements that were detected.
 */
export function feed(acc: LineAccumulator, token: string): FeedResult {
  const statements: Statement[] = []

  for (const char of token) {
    switch (acc.mode) {
      case 'typescript': {
        // Detect 4-backtick file block start: consecutive backticks when
        // the buffer contains only whitespace (start of a statement).
        if (char === '`' && acc.buffer.trimStart() === '') {
          acc.pendingBackticks++
          if (acc.pendingBackticks === 4) {
            acc.pendingBackticks = 0
            acc.mode = 'file_block_header'
            acc.fileBlockHeader = ''
          }
          // Keep pending backticks out of the buffer for now
        } else {
          // Flush any pending backticks that didn't form a 4-backtick block
          if (acc.pendingBackticks > 0) {
            for (let i = 0; i < acc.pendingBackticks; i++) {
              acc.buffer += '`'
              feedChunk(acc.bracketState, '`')
            }
            acc.pendingBackticks = 0
          }

          acc.buffer += char
          feedChunk(acc.bracketState, char)

          if (char === '\n' && isBalanced(acc.bracketState)) {
            const trimmed = acc.buffer.trim()
            if (trimmed.length > 0 && isCompleteStatement(trimmed)) {
              statements.push({ type: 'code', source: trimmed })
              acc.buffer = ''
              resetBracketState(acc.bracketState)
            }
          }
        }
        break
      }

      case 'file_block_header': {
        if (char === '\n') {
          const header = acc.fileBlockHeader.trim()
          if (header.startsWith('diff ')) {
            acc.mode = 'file_diff'
            acc.fileBlockPath = header.slice(5).trim()
          } else {
            acc.mode = 'file_write'
            acc.fileBlockPath = header
          }
          acc.fileBlockContent = ''
          acc.fileBlockCurrentLine = ''
        } else {
          acc.fileBlockHeader += char
        }
        break
      }

      case 'file_write':
      case 'file_diff': {
        if (char === '\n') {
          if (acc.fileBlockCurrentLine === '````') {
            // Closing marker — emit the file block statement
            const path = acc.fileBlockPath
            const rawContent = acc.fileBlockContent
            if (acc.mode === 'file_diff') {
              statements.push({ type: 'file_diff', path, diff: rawContent })
            } else {
              statements.push({ type: 'file_write', path, content: rawContent })
            }
            // Reset to typescript mode
            acc.mode = 'typescript'
            acc.fileBlockPath = ''
            acc.fileBlockContent = ''
            acc.fileBlockCurrentLine = ''
            acc.fileBlockHeader = ''
          } else {
            acc.fileBlockContent += acc.fileBlockCurrentLine + '\n'
            acc.fileBlockCurrentLine = ''
          }
        } else {
          acc.fileBlockCurrentLine += char
        }
        break
      }
    }
  }

  const hasRemaining =
    acc.buffer.trim().length > 0 ||
    acc.mode !== 'typescript' ||
    acc.pendingBackticks > 0

  return { statements, hasRemaining }
}

/**
 * Flush any remaining content in the buffer as a statement.
 * Called when the LLM stream ends.
 * File blocks in progress are discarded (no closing marker arrived).
 */
export function flush(acc: LineAccumulator): Statement | null {
  // Discard incomplete file blocks
  if (acc.mode === 'file_block_header' || acc.mode === 'file_write' || acc.mode === 'file_diff') {
    acc.mode = 'typescript'
    acc.fileBlockPath = ''
    acc.fileBlockContent = ''
    acc.fileBlockCurrentLine = ''
    acc.fileBlockHeader = ''
    acc.pendingBackticks = 0
    return null
  }

  // Flush pending backticks into the buffer
  if (acc.pendingBackticks > 0) {
    for (let i = 0; i < acc.pendingBackticks; i++) {
      acc.buffer += '`'
    }
    acc.pendingBackticks = 0
  }

  const trimmed = acc.buffer.trim()
  if (trimmed.length === 0) return null

  acc.buffer = ''
  resetBracketState(acc.bracketState)
  return { type: 'code', source: trimmed }
}

/**
 * Clear the accumulator without returning any content.
 */
export function clear(acc: LineAccumulator): void {
  acc.buffer = ''
  resetBracketState(acc.bracketState)
  acc.mode = 'typescript'
  acc.pendingBackticks = 0
  acc.fileBlockHeader = ''
  acc.fileBlockPath = ''
  acc.fileBlockContent = ''
  acc.fileBlockCurrentLine = ''
}
