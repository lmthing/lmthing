/**
 * Determines if a buffered string is a complete TypeScript statement.
 * Uses bracket depth, JSX depth, and string context tracking as a heuristic.
 */
export function isCompleteStatement(buffer: string): boolean {
  const trimmed = buffer.trim()
  if (trimmed.length === 0) return false

  let roundDepth = 0
  let curlyDepth = 0
  let squareDepth = 0
  let jsxDepth = 0
  let jsxTagState: 'none' | 'open' | 'close' = 'none'
  let inString: false | "'" | '"' | '`' = false
  let inLineComment = false
  let inBlockComment = false
  let i = 0

  while (i < trimmed.length) {
    const ch = trimmed[i]
    const next = trimmed[i + 1]

    // Handle line comments
    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      i++
      continue
    }

    // Handle block comments
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i += 2
        continue
      }
      i++
      continue
    }

    // Handle strings
    if (inString) {
      if (ch === '\\') {
        i += 2 // skip escaped char
        continue
      }
      if (inString === '`') {
        // Template literal — handle ${} interpolation
        if (ch === '$' && next === '{') {
          // We don't need to track template expression depth for completeness,
          // just need to not exit template on } inside ${}
          // Simplified: just track that we're in a template
        }
        if (ch === '`') {
          inString = false
        }
      } else if (ch === inString) {
        inString = false
      }
      i++
      continue
    }

    // Start comment
    if (ch === '/' && next === '/') {
      inLineComment = true
      i += 2
      continue
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true
      i += 2
      continue
    }

    // Start string
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = ch
      i++
      continue
    }

    // --- JSX tracking (uses lookahead since full buffer is available) ---

    // Self-closing /> in open tag
    if (jsxTagState === 'open' && ch === '/' && next === '>') {
      jsxDepth = Math.max(0, jsxDepth - 1)
      jsxTagState = 'none'
      i += 2
      continue
    }

    // Opening tag close > (only when not inside {expressions})
    if (jsxTagState === 'open' && ch === '>' && curlyDepth === 0 && roundDepth === 0 && squareDepth === 0) {
      jsxTagState = 'none'
      i++
      continue
    }

    // Closing tag close >
    if (jsxTagState === 'close' && ch === '>') {
      jsxDepth = Math.max(0, jsxDepth - 1)
      jsxTagState = 'none'
      i++
      continue
    }

    // JSX opening tag: <Letter
    if (ch === '<' && jsxTagState === 'none' && next && /[a-zA-Z]/.test(next)) {
      jsxDepth++
      jsxTagState = 'open'
      i += 2 // skip '<' and first letter
      continue
    }

    // JSX closing tag: </
    if (ch === '<' && jsxTagState === 'none' && next === '/') {
      jsxTagState = 'close'
      i += 2
      continue
    }

    // JSX fragment: <>
    if (ch === '<' && jsxTagState === 'none' && next === '>') {
      jsxDepth++
      i += 2
      continue
    }

    // Track brackets
    if (ch === '(') roundDepth++
    else if (ch === ')') roundDepth = Math.max(0, roundDepth - 1)
    else if (ch === '{') curlyDepth++
    else if (ch === '}') curlyDepth = Math.max(0, curlyDepth - 1)
    else if (ch === '[') squareDepth++
    else if (ch === ']') squareDepth = Math.max(0, squareDepth - 1)

    i++
  }

  // Complete if all brackets balanced and not inside string/comment/JSX
  if (inString !== false || inBlockComment) return false
  if (roundDepth !== 0 || curlyDepth !== 0 || squareDepth !== 0) return false
  if (jsxDepth !== 0 || jsxTagState !== 'none') return false

  return true
}
