export interface CodeTurn {
  lines: string[]
  declarations: string[]
  turnIndex: number
}

/**
 * Compress code turns beyond the sliding window.
 * Keeps the most recent N lines verbatim; older code replaced with summaries.
 */
export function compressCodeWindow(
  turns: CodeTurn[],
  maxLines: number,
): string[] {
  if (turns.length === 0) return []

  // Count total lines
  let totalLines = turns.reduce((sum, t) => sum + t.lines.length, 0)

  if (totalLines <= maxLines) {
    return turns.flatMap(t => t.lines)
  }

  // Work backwards from most recent, keeping turns verbatim until we exceed budget
  const result: string[] = []
  const summaries: string[] = []
  let linesRemaining = maxLines

  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]
    if (linesRemaining >= turn.lines.length) {
      result.unshift(...turn.lines)
      linesRemaining -= turn.lines.length
    } else {
      // Summarize this turn
      const startLine = turn.turnIndex
      const endLine = startLine + turn.lines.length - 1
      const declList = turn.declarations.length > 0
        ? ` declared: ${turn.declarations.join(', ')}`
        : ''
      summaries.unshift(`// [lines ${startLine}-${endLine} executed]${declList}`)
    }
  }

  return [...summaries, ...result]
}

/**
 * Build a summary comment for a compressed code section.
 */
export function buildSummaryComment(
  startLine: number,
  endLine: number,
  declarations: string[],
): string {
  const declList = declarations.length > 0
    ? ` declared: ${declarations.join(', ')}`
    : ''
  return `// [lines ${startLine}-${endLine} executed]${declList}`
}
