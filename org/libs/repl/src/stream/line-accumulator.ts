import { createBracketState, feedChunk, isBalanced, resetBracketState, type BracketState } from './bracket-tracker'
import { isCompleteStatement } from '../parser/statement-detector'

export interface LineAccumulator {
  buffer: string
  bracketState: BracketState
}

export function createLineAccumulator(): LineAccumulator {
  return {
    buffer: '',
    bracketState: createBracketState(),
  }
}

export interface FeedResult {
  /** Complete statements that were flushed */
  statements: string[]
  /** Whether there's still content in the buffer */
  hasRemaining: boolean
}

/**
 * Feed a token (chunk of text) into the accumulator.
 * Returns any complete statements that were detected.
 */
export function feed(acc: LineAccumulator, token: string): FeedResult {
  const statements: string[] = []

  for (const char of token) {
    acc.buffer += char
    feedChunk(acc.bracketState, char)

    // Check for statement completion on newlines
    if (char === '\n' && isBalanced(acc.bracketState)) {
      const trimmed = acc.buffer.trim()
      if (trimmed.length > 0 && isCompleteStatement(trimmed)) {
        statements.push(trimmed)
        acc.buffer = ''
        resetBracketState(acc.bracketState)
      }
    }
  }

  return {
    statements,
    hasRemaining: acc.buffer.trim().length > 0,
  }
}

/**
 * Flush any remaining content in the buffer as a statement.
 * Called when the LLM stream ends.
 */
export function flush(acc: LineAccumulator): string | null {
  const trimmed = acc.buffer.trim()
  if (trimmed.length === 0) return null
  acc.buffer = ''
  resetBracketState(acc.bracketState)
  return trimmed
}

/**
 * Clear the accumulator without returning any content.
 */
export function clear(acc: LineAccumulator): void {
  acc.buffer = ''
  resetBracketState(acc.bracketState)
}
