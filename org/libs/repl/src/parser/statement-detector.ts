/**
 * Determines if a buffered string is a complete TypeScript statement.
 * Uses bracket depth and string context tracking as a heuristic.
 */
export function isCompleteStatement(buffer: string): boolean {
  const trimmed = buffer.trim()
  if (trimmed.length === 0) return false

  let roundDepth = 0
  let curlyDepth = 0
  let squareDepth = 0
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

    // Track brackets
    if (ch === '(') roundDepth++
    else if (ch === ')') roundDepth = Math.max(0, roundDepth - 1)
    else if (ch === '{') curlyDepth++
    else if (ch === '}') curlyDepth = Math.max(0, curlyDepth - 1)
    else if (ch === '[') squareDepth++
    else if (ch === ']') squareDepth = Math.max(0, squareDepth - 1)

    i++
  }

  // Complete if all brackets balanced and not inside string/comment
  if (inString !== false || inBlockComment) return false
  if (roundDepth !== 0 || curlyDepth !== 0 || squareDepth !== 0) return false

  return true
}
