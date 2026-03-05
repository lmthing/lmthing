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

// Token types for glob parsing
enum TokenType {
  Literal,
  Star,
  DoubleStar,
  Question,
  ClassOpen,
  ClassClose,
  ClassNegate,
  ExtglobOpen,
  ExtglobClose,
  ExtglobSep,
  Pipe
}

interface Token {
  type: TokenType
  value: string
  index: number
}

// Parser state
class GlobParser {
  private pos = 0
  private tokens: Token[] = []
  private readonly pattern: string

  constructor(pattern: string) {
    this.pattern = pattern
  }

  parse(): Token[] {
    while (this.pos < this.pattern.length) {
      const char = this.pattern[this.pos]

      if (char === '\\') {
        this.parseEscape()
      } else if (char === '*') {
        this.parseStar()
      } else if (char === '?') {
        this.tokens.push({ type: TokenType.Question, value: '?', index: this.pos })
        this.pos++
      } else if (char === '[') {
        this.parseClass()
      } else if (char === '@' || char === '*' || char === '+' || char === '?' || char === '!') {
        this.parseExtglob()
      } else {
        this.tokens.push({ type: TokenType.Literal, value: char, index: this.pos })
        this.pos++
      }
    }

    return this.tokens
  }

  private parseEscape(): void {
    this.pos++
    if (this.pos < this.pattern.length) {
      this.tokens.push({
        type: TokenType.Literal,
        value: this.pattern[this.pos],
        index: this.pos - 1
      })
      this.pos++
    }
  }

  private parseStar(): void {
    const start = this.pos
    this.pos++
    if (this.pos < this.pattern.length && this.pattern[this.pos] === '*') {
      this.pos++
      this.tokens.push({ type: TokenType.DoubleStar, value: '**', index: start })
    } else {
      this.tokens.push({ type: TokenType.Star, value: '*', index: start })
    }
  }

  private parseClass(): void {
    const start = this.pos
    this.pos++
    let negate = false

    if (this.pos < this.pattern.length && (this.pattern[this.pos] === '!' || this.pattern[this.pos] === '^')) {
      negate = true
      this.pos++
    }

    let value = '['
    if (negate) value += '!'

    while (this.pos < this.pattern.length && this.pattern[this.pos] !== ']') {
      if (this.pattern[this.pos] === '\\') {
        this.pos++
        if (this.pos < this.pattern.length) {
          value += this.pattern[this.pos]
        }
      } else {
        value += this.pattern[this.pos]
      }
      this.pos++
    }

    if (this.pos < this.pattern.length) {
      value += ']'
      this.pos++
    }

    this.tokens.push({
      type: TokenType.ClassOpen,
      value,
      index: start
    })
  }

  private parseExtglob(): void {
    const start = this.pos
    const modifier = this.pattern[this.pos]
    this.pos++

    if (this.pos < this.pattern.length && this.pattern[this.pos] === '(') {
      // This is an extglob pattern
      this.pos++
      let depth = 1
      let value = modifier + '('

      while (this.pos < this.pattern.length && depth > 0) {
        const char = this.pattern[this.pos]
        if (char === '\\') {
          value += char
          this.pos++
          if (this.pos < this.pattern.length) {
            value += this.pattern[this.pos]
          }
        } else if (char === '(') {
          depth++
          value += char
        } else if (char === ')') {
          depth--
          if (depth > 0) value += char
        } else if (char === '|') {
          value += char
        } else {
          value += char
        }
        this.pos++
      }

      value += ')'
      this.tokens.push({
        type: TokenType.ExtglobOpen,
        value,
        index: start
      })
    } else {
      // Not an extglob, just a literal @, *, +, ?, or !
      this.tokens.push({
        type: TokenType.Literal,
        value: modifier,
        index: start
      })
    }
  }
}

// Regex generator
class RegexGenerator {
  private output = ''
  private inClass = false
  private readonly captureLeadingSlash = true

  generate(tokens: Token[], isNegated: boolean): string {
    if (isNegated) {
      // For negated patterns, we need to match everything EXCEPT the pattern
      this.output = '(?!'
      this.generateInner(tokens)
      this.output += '$).+'
    } else {
      this.output = '^'
      this.generateInner(tokens)
      this.output += '$'
    }
    return this.output
  }

  private generateInner(tokens: Token[]): void {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      switch (token.type) {
        case TokenType.Literal:
          this.output += this.escapeRegex(token.value)
          break

        case TokenType.Star:
          this.output += '[^/]*'
          break

        case TokenType.DoubleStar:
          // ** matches zero or more directories
          // Need to handle this carefully
          const next = tokens[i + 1]
          const prev = tokens[i - 1]

          if (prev && prev.type === TokenType.Literal && prev.value === '/') {
            // /** at start or after slash
            if (next && next.type === TokenType.Literal && next.value === '/') {
              // /**/ - match any directory depth
              this.output += '(?:/|/.*/)'
            } else {
              this.output += '.*'
            }
          } else if (!prev) {
            // Leading **
            this.output += '.*'
          } else if (next && next.type === TokenType.Literal && next.value === '/') {
            // **/ - match any path ending with /
            this.output += '.*'
          } else {
            this.output += '.*'
          }
          break

        case TokenType.Question:
          this.output += '[^/]'
          break

        case TokenType.ClassOpen: {
          const classValue = token.value
          this.output += this.parseCharacterClass(classValue)
          break
        }

        case TokenType.ExtglobOpen: {
          this.output += this.parseExtglob(token.value)
          break
        }

        default:
          break
      }
    }
  }

  private escapeRegex(char: string): string {
    return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private parseCharacterClass(classStr: string): string {
    // Remove the outer brackets
    const inner = classStr.slice(1, -1)
    let negate = false
    let content = inner

    if (inner.startsWith('!') || inner.startsWith('^')) {
      negate = true
      content = inner.slice(1)
    }

    // Parse ranges like a-z
    const parsed = content.replace(/(\w)-(\w)/g, '$1-$2')

    return `[${negate ? '^' : ''}${parsed}]`
  }

  private parseExtglob(extglob: string): string {
    // Parse @(a|b|c) -> (?:a|b|c)
    // Parse *(a|b|c) -> (?:(?:a|b|c)*)
    // Parse +(a|b|c) -> (?:(?:a|b|c)+)
    // Parse !(a|b|c) -> (?:(?!a|b|c).+)  (negation)
    // Parse ?(a|b|c) -> (?:(?:a|b|c))?

    const modifier = extglob[0]
    const inner = extglob.slice(2, -1) // Remove modifier and parens

    // Parse the alternations
    const options = this.parseAlternations(inner)

    const alternations = options.map(opt => this.generateOptionRegex(opt)).join('|')

    switch (modifier) {
      case '@':
        return `(?:${alternations})`
      case '*':
        return (?:(?:${alternations})*`
      case '+':
        return (?:(?:${alternations})+`
      case '?':
        return (?:(?:${alternations}))?`
      case '!':
        return (?:(?!${alternations}).+`
      default:
        return `(?:${alternations})`
    }
  }

  private parseAlternations(str: string): string[] {
    const options: string[] = []
    let current = ''
    let depth = 0
    let inClass = false

    for (const char of str) {
      if (char === '[' && !inClass) {
        inClass = true
        current += char
      } else if (char === ']' && inClass) {
        inClass = false
        current += char
      } else if (char === '|' && depth === 0 && !inClass) {
        options.push(current)
        current = ''
      } else if (char === '(' && !inClass) {
        depth++
        current += char
      } else if (char === ')' && !inClass) {
        depth--
        current += char
      } else {
        current += char
      }
    }

    if (current) {
      options.push(current)
    }

    return options
  }

  private generateOptionRegex(option: string): string {
    let result = '^'
    let i = 0

    while (i < option.length) {
      const char = option[i]

      if (char === '\\') {
        i++
        if (i < option.length) {
          result += this.escapeRegex(option[i])
        }
      } else if (char === '*') {
        i++
        if (i < option.length && option[i] === '*') {
          result += '.*'
          i++
        } else {
          result += '[^/]*'
        }
      } else if (char === '?') {
        result += '[^/]'
      } else if (char === '[') {
        let end = option.indexOf(']', i)
        if (end === -1) end = option.length
        result += option.slice(i, end + 1)
        i = end + 1
      } else {
        result += this.escapeRegex(char)
      }
      i++
    }

    return result.slice(1) // Remove leading ^
  }
}

// Main compiler
export function globToRegex(pattern: string): RegExp {
  const isNegated = pattern.startsWith('!')
  const actualPattern = isNegated ? pattern.slice(1) : pattern

  // Fast path for simple patterns
  if (!hasSpecialChars(actualPattern)) {
    return new RegExp(`^${escapeRegex(actualPattern)}$`)
  }

  // Parse and compile
  const parser = new GlobParser(actualPattern)
  const tokens = parser.parse()

  const generator = new RegexGenerator()
  const regexStr = generator.generate(tokens, isNegated)

  return new RegExp(regexStr)
}

function hasSpecialChars(pattern: string): boolean {
  return /[*?[\]{}()|!@+]/.test(pattern)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Test a single path against a glob pattern
export function testPath(path: string, pattern: string): boolean {
  const matcher = compileGlob(pattern)
  return matcher.regex.test(path) !== matcher.isNegated
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

// Match multiple patterns against a path
export function matchAny(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (testPath(path, pattern)) {
      return true
    }
  }
  return false
}

// Filter paths by glob pattern
export function filterPaths(paths: string[], pattern: string): string[] {
  const matcher = compileGlob(pattern)
  return paths.filter(path => {
    const matches = matcher.regex.test(path)
    return matcher.isNegated ? !matches : matches
  })
}

// Brace expansion: {a,b,c} -> a b c
export function expandBraces(pattern: string): string[] {
  const results: string[] = []

  function expand(str: string, output: string[]) {
    const openIdx = str.indexOf('{')
    if (openIdx === -1) {
      output.push(str)
      return
    }

    const closeIdx = findMatchingBrace(str, openIdx)
    if (closeIdx === -1) {
      output.push(str)
      return
    }

    const prefix = str.slice(0, openIdx)
    const suffix = str.slice(closeIdx + 1)
    const inner = str.slice(openIdx + 1, closeIdx)

    const options = inner.split(',').map(o => o.trim())

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

// Check if a pattern is a valid glob
export function isValidGlob(pattern: string): boolean {
  try {
    globToRegex(pattern)
    return true
  } catch {
    return false
  }
}
