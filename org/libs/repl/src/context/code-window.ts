export interface CodeTurn {
  lines: string[]
  declarations: string[]
  turnIndex: number
}

/**
 * Compute a priority score for a turn based on semantic anchoring:
 * - Turns with @keep directives get highest priority
 * - Turns declaring functions/classes referenced by later turns get higher priority
 * - Recent turns get higher priority (recency bias)
 */
function computeTurnPriority(
  turn: CodeTurn,
  turnIdx: number,
  totalTurns: number,
  allDeclarations: Set<string>,
  laterCode: string,
): number {
  let priority = 0

  // Recency: most recent turns have highest base priority
  priority += (turnIdx / totalTurns) * 10

  // @keep directive: maximum priority
  if (turn.lines.some(l => l.includes('// @keep'))) {
    priority += 100
  }

  // Reference counting: declarations referenced in later code
  for (const decl of turn.declarations) {
    // Check if this declaration is used in later code (simple word boundary check)
    const regex = new RegExp(`\\b${decl}\\b`)
    if (regex.test(laterCode)) {
      priority += 5
    }
  }

  // Function/class declarations get a boost
  for (const line of turn.lines) {
    const trimmed = line.trim()
    if (/^(var|let|const)\s+\w+\s*=\s*(async\s+)?function/.test(trimmed) ||
        /^function\s+\w+/.test(trimmed) ||
        /^class\s+\w+/.test(trimmed)) {
      priority += 3
    }
  }

  return priority
}

/**
 * Compress code turns beyond the sliding window.
 * Uses semantic anchoring: keeps high-priority turns (referenced declarations,
 * @keep directives, function/class definitions) and summarizes low-priority ones.
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

  // Collect all declarations and build "later code" string per turn
  const allDeclarations = new Set<string>()
  for (const turn of turns) {
    for (const d of turn.declarations) allDeclarations.add(d)
  }

  // Compute priority for each turn
  const priorities: Array<{ turnIdx: number; priority: number; turn: CodeTurn }> = []
  for (let i = 0; i < turns.length; i++) {
    // "Later code" = all code from turns after this one
    const laterCode = turns.slice(i + 1).flatMap(t => t.lines).join('\n')
    priorities.push({
      turnIdx: i,
      priority: computeTurnPriority(turns[i], i, turns.length, allDeclarations, laterCode),
      turn: turns[i],
    })
  }

  // Sort by priority (lowest first = first to be summarized)
  const sortedByPriority = [...priorities].sort((a, b) => a.priority - b.priority)

  // Greedily summarize lowest-priority turns until we're within budget
  const summarizedTurns = new Set<number>()
  let currentLines = totalLines

  for (const entry of sortedByPriority) {
    if (currentLines <= maxLines) break
    summarizedTurns.add(entry.turnIdx)
    currentLines -= entry.turn.lines.length
    currentLines += 1 // summary line
  }

  // Build output preserving original order
  const result: string[] = []
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    if (summarizedTurns.has(i)) {
      const startLine = turn.turnIndex
      const endLine = startLine + turn.lines.length - 1
      const declList = turn.declarations.length > 0
        ? ` declared: ${turn.declarations.join(', ')}`
        : ''
      result.push(`// [lines ${startLine}-${endLine} executed]${declList}`)
    } else {
      result.push(...turn.lines)
    }
  }

  return result
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
