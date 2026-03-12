// src/lib/fs/glob.ts
//
// Advanced glob pattern matching supporting:
// - * matches any sequence except /
// - ** matches any sequence including /
// - ? matches any single character except /
// - [a-z] character classes
// - [!a-z] or [^a-z] negated character classes
// - @(a|b) one of the given patterns (extglob)
// - *(a|b) zero or more of the given patterns (extglob)
// - +(a|b) one or more of the given patterns (extglob)
// - ?(a|b) zero or one of the given patterns (extglob)
// - !(a|b) anything except the given patterns (extglob)
// - Leading ! for negation

export interface GlobMatcher {
  pattern: string
  regex: RegExp
  isNegated: boolean
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Split on top-level pipe alternations (respecting nested parens)
function splitAlternations(str: string): string[] {
  const parts: string[] = []
  let cur = ''
  let depth = 0
  for (const ch of str) {
    if (ch === '(') { depth++; cur += ch }
    else if (ch === ')') { depth--; cur += ch }
    else if (ch === '|' && depth === 0) { parts.push(cur); cur = '' }
    else { cur += ch }
  }
  parts.push(cur)
  return parts
}

// Split on top-level commas (respecting nested braces)
function splitTopLevelCommas(str: string): string[] {
  const parts: string[] = []
  let cur = ''
  let depth = 0
  for (const ch of str) {
    if (ch === '{') { depth++; cur += ch }
    else if (ch === '}') { depth--; cur += ch }
    else if (ch === ',' && depth === 0) { parts.push(cur); cur = '' }
    else { cur += ch }
  }
  parts.push(cur)
  return parts
}

// Convert a glob pattern (no leading !) to an unanchored regex string
function globPatternToRegexStr(pattern: string): string {
  let result = ''
  let i = 0
  while (i < pattern.length) {
    const ch = pattern[i]

    // Extglob modifiers: @, *, +, ?, ! followed by (
    if (
      (ch === '@' || ch === '*' || ch === '+' || ch === '?' || ch === '!') &&
      i + 1 < pattern.length && pattern[i + 1] === '('
    ) {
      // Find matching closing paren
      let depth = 0
      let end = i + 1
      while (end < pattern.length) {
        if (pattern[end] === '(') depth++
        else if (pattern[end] === ')') { depth--; if (depth === 0) break }
        end++
      }
      const inner = pattern.slice(i + 2, end)
      const opts = splitAlternations(inner).map(o => globPatternToRegexStr(o))
      const alt = opts.join('|')
      switch (ch) {
        case '@': result += `(?:${alt})`; break
        case '*': result += `(?:${alt})*`; break
        case '+': result += `(?:${alt})+`; break
        case '?': result += `(?:${alt})?`; break
        case '!': result += `(?:(?!(?:${alt}))[^/]*)`; break
      }
      i = end + 1
      continue
    }

    // Double-star **
    if (ch === '*' && i + 1 < pattern.length && pattern[i + 1] === '*') {
      const prevSlash = result.endsWith('/')
      const nextSlash = i + 2 < pattern.length && pattern[i + 2] === '/'

      if (prevSlash && nextSlash) {
        // /**/  -> optional middle path segments
        result = result.slice(0, -1) // remove trailing /
        result += '(?:/.*)?'
        i += 2 // skip **, the following / is handled in next iteration
      } else if (prevSlash) {
        // /** at end
        result = result.slice(0, -1)
        result += '(?:/.*)?'
        i += 2
      } else if (nextSlash) {
        // **/ at start or after non-slash
        result += '(?:.*/)?'
        i += 3 // skip ** and /
      } else {
        result += '.*'
        i += 2
      }
      continue
    }

    // Single star *
    if (ch === '*') { result += '[^/]*'; i++; continue }

    // Single ?
    if (ch === '?') { result += '[^/]'; i++; continue }

    // Character class [...]
    if (ch === '[') {
      let end = i + 1
      if (end < pattern.length && (pattern[end] === '!' || pattern[end] === '^')) end++
      if (end < pattern.length && pattern[end] === ']') end++ // allow ] as first char
      while (end < pattern.length && pattern[end] !== ']') end++
      const classStr = pattern.slice(i, end + 1)
      result += classStr.replace(/^\[!/, '[^')
      i = end + 1
      continue
    }

    // Escape sequence
    if (ch === '\\' && i + 1 < pattern.length) {
      result += escapeRegex(pattern[i + 1])
      i += 2
      continue
    }

    result += escapeRegex(ch)
    i++
  }
  return result
}

// Compile a glob pattern to a RegExp
export function globToRegex(pattern: string): RegExp {
  const isNegated = pattern.startsWith('!')
  const actualPattern = isNegated ? pattern.slice(1) : pattern
  const inner = globPatternToRegexStr(actualPattern)
  if (isNegated) {
    return new RegExp(`^(?!${inner}$).*$`)
  }
  return new RegExp(`^${inner}$`)
}

// Test a single path against a glob pattern
export function testPath(path: string, pattern: string): boolean {
  return globToRegex(pattern).test(path)
}

// Compile a glob pattern to a reusable matcher
export function compileGlob(pattern: string): GlobMatcher {
  const isNegated = pattern.startsWith('!')
  const actualPattern = isNegated ? pattern.slice(1) : pattern
  return {
    pattern: actualPattern,
    regex: globToRegex(pattern),
    isNegated
  }
}

// Match any of the given patterns against a path
export function matchAny(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (testPath(path, pattern)) return true
  }
  return false
}

// Filter paths by glob pattern
export function filterPaths(paths: string[], pattern: string): string[] {
  return paths.filter(p => testPath(p, pattern))
}

// Brace expansion: file.{a,{b,c}} -> ['file.a', 'file.b', 'file.c']
export function expandBraces(pattern: string): string[] {
  const results: string[] = []

  function expand(str: string, output: string[]) {
    const openIdx = str.indexOf('{')
    if (openIdx === -1) { output.push(str); return }

    const closeIdx = findMatchingBrace(str, openIdx)
    if (closeIdx === -1) { output.push(str); return }

    const prefix = str.slice(0, openIdx)
    const suffix = str.slice(closeIdx + 1)
    const inner = str.slice(openIdx + 1, closeIdx)
    const options = splitTopLevelCommas(inner)

    for (const opt of options) {
      expand(prefix + opt + suffix, output)
    }
  }

  expand(pattern, results)
  return results
}

function findMatchingBrace(str: string, start: number): number {
  let depth = 1
  for (let i = start + 1; i < str.length; i++) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') depth--
    if (depth === 0) return i
  }
  return -1
}

// Check if a pattern is valid
export function isValidGlob(pattern: string): boolean {
  try {
    globToRegex(pattern)
    return true
  } catch {
    return false
  }
}
