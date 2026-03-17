/**
 * Detects if a source line is a call to one of the four globals.
 * Handles both `stop(...)` and `await stop(...)` patterns.
 */
export type GlobalName = 'stop' | 'display' | 'ask' | 'async'

const GLOBALS: GlobalName[] = ['stop', 'display', 'ask', 'async']

export function detectGlobalCall(source: string): GlobalName | null {
  const trimmed = source.trim()

  // Strip leading await
  const withoutAwait = trimmed.startsWith('await ')
    ? trimmed.slice(6).trim()
    : trimmed

  for (const name of GLOBALS) {
    // Match: name(  or  name<whitespace>( — the function call pattern
    if (withoutAwait.startsWith(name + '(') || withoutAwait.startsWith(name + ' (')) {
      return name
    }
  }

  // Also check for assignment patterns: const result = await ask(...)
  const assignMatch = trimmed.match(/^(?:const|let|var)\s+\w+\s*=\s*(?:await\s+)?(\w+)\s*\(/)
  if (assignMatch) {
    const callee = assignMatch[1] as GlobalName
    if (GLOBALS.includes(callee)) {
      return callee
    }
  }

  return null
}
