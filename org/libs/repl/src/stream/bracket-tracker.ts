export interface BracketState {
  round: number
  curly: number
  square: number
  inString: false | "'" | '"' | '`'
  inLineComment: boolean
  inBlockComment: boolean
  templateDepth: number
  /** JSX nesting depth — tracks open/close tag pairs */
  jsxDepth: number
  /**
   * JSX tag parsing state:
   * - 'none': not inside a JSX tag
   * - 'pending_open': saw '<', waiting for next char to classify
   * - 'open': inside an opening tag <Component ...
   * - 'close': inside a closing tag </Component...
   * - 'selfclose_pending': saw '/' inside opening tag, waiting for '>'
   */
  jsxTagState: 'none' | 'pending_open' | 'open' | 'close' | 'selfclose_pending'
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
    jsxDepth: 0,
    jsxTagState: 'none',
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

    // --- JSX tracking ---

    // pending_open: classify the char after '<'
    if (state.jsxTagState === 'pending_open') {
      if (/[a-zA-Z]/.test(ch)) {
        state.jsxDepth++
        state.jsxTagState = 'open'
        continue
      } else if (ch === '/') {
        state.jsxTagState = 'close'
        continue
      } else if (ch === '>') {
        state.jsxDepth++ // fragment <>
        state.jsxTagState = 'none'
        continue
      } else {
        state.jsxTagState = 'none'
        // Not JSX — fall through to bracket tracking
        // (ch might be '{', '(', etc. after a comparison '<')
      }
    }

    // selfclose_pending: saw '/' in an open tag, expecting '>'
    if (state.jsxTagState === 'selfclose_pending') {
      if (ch === '>') {
        state.jsxDepth = Math.max(0, state.jsxDepth - 1)
        state.jsxTagState = 'none'
        continue
      }
      // Not />, revert to open — fall through to process this char
      state.jsxTagState = 'open'
    }

    // open: inside <Component ... — looking for '/' or '>'
    if (state.jsxTagState === 'open') {
      if (ch === '/') {
        state.jsxTagState = 'selfclose_pending'
        continue
      }
      if (ch === '>' && state.curly === 0 && state.round === 0 && state.square === 0) {
        // Opening tag complete — children follow, jsxDepth stays incremented
        state.jsxTagState = 'none'
        continue
      }
      // Other chars (attributes, {expressions}) — fall through to bracket tracking
    }

    // close: inside </Component... — looking for '>'
    if (state.jsxTagState === 'close') {
      if (ch === '>') {
        state.jsxDepth = Math.max(0, state.jsxDepth - 1)
        state.jsxTagState = 'none'
      }
      continue // skip bracket tracking for all chars in close tag
    }

    // Detect '<' for potential JSX (only when not already in a tag)
    if (ch === '<' && state.jsxTagState === 'none') {
      state.jsxTagState = 'pending_open'
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
    state.jsxDepth === 0 &&
    state.jsxTagState === 'none' &&
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
  state.jsxDepth = 0
  state.jsxTagState = 'none'
}
