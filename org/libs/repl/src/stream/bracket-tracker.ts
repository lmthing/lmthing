export interface BracketState {
  round: number
  curly: number
  square: number
  inString: false | "'" | '"' | '`'
  inLineComment: boolean
  inBlockComment: boolean
  templateDepth: number
}

export function createBracketState(): BracketState {
  return {
    round: 0,
    curly: 0,
    square: 0,
    inString: false,
    inLineComment: false,
    inBlockComment: false,
    templateDepth: 0,
  }
}

/**
 * Feed a chunk of text into the bracket tracker, updating state character by character.
 * Returns the updated state (mutates and returns the same object for performance).
 */
export function feedChunk(state: BracketState, chunk: string): BracketState {
  for (let i = 0; i < chunk.length; i++) {
    const ch = chunk[i]
    const next = chunk[i + 1]

    // Line comment
    if (state.inLineComment) {
      if (ch === '\n') state.inLineComment = false
      continue
    }

    // Block comment
    if (state.inBlockComment) {
      if (ch === '*' && next === '/') {
        state.inBlockComment = false
        i++ // skip /
      }
      continue
    }

    // Inside string
    if (state.inString) {
      if (ch === '\\') {
        i++ // skip escaped char
        continue
      }
      if (state.inString === '`') {
        if (ch === '`') {
          state.inString = false
        }
        // Note: template expression ${} handling is simplified
      } else if (ch === state.inString) {
        state.inString = false
      }
      continue
    }

    // Start comment
    if (ch === '/' && next === '/') {
      state.inLineComment = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      state.inBlockComment = true
      i++
      continue
    }

    // Start string
    if (ch === "'" || ch === '"' || ch === '`') {
      state.inString = ch
      continue
    }

    // Brackets
    if (ch === '(') state.round++
    else if (ch === ')') state.round = Math.max(0, state.round - 1)
    else if (ch === '{') state.curly++
    else if (ch === '}') state.curly = Math.max(0, state.curly - 1)
    else if (ch === '[') state.square++
    else if (ch === ']') state.square = Math.max(0, state.square - 1)
  }

  return state
}

/**
 * Returns true if all brackets are balanced and we're not inside a string/comment.
 */
export function isBalanced(state: BracketState): boolean {
  return (
    state.round === 0 &&
    state.curly === 0 &&
    state.square === 0 &&
    state.inString === false &&
    !state.inBlockComment
  )
}

/**
 * Reset the bracket state.
 */
export function resetBracketState(state: BracketState): void {
  state.round = 0
  state.curly = 0
  state.square = 0
  state.inString = false
  state.inLineComment = false
  state.inBlockComment = false
  state.templateDepth = 0
}
