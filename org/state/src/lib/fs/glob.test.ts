// src/lib/fs/glob.test.ts

import { describe, it, expect } from 'vitest'
import { globToRegex, testPath, compileGlob, expandBraces } from './glob'

describe('globToRegex', () => {
  describe('basic patterns', () => {
    it('should match exact paths', () => {
      const regex = globToRegex('file.txt')
      expect(regex.test('file.txt')).toBe(true)
      expect(regex.test('other.txt')).toBe(false)
    })

    it('should match * (any chars except /)', () => {
      const regex = globToRegex('src/*.ts')
      expect(regex.test('src/file.ts')).toBe(true)
      expect(regex.test('src/nested/file.ts')).toBe(false)
    })

    it('should match ** (any chars including /)', () => {
      const regex = globToRegex('src/**/*.ts')
      expect(regex.test('src/file.ts')).toBe(true)
      expect(regex.test('src/nested/file.ts')).toBe(true)
      expect(regex.test('src/a/b/c/file.ts')).toBe(true)
    })

    it('should match ? (single char)', () => {
      const regex = globToRegex('file?.txt')
      expect(regex.test('file1.txt')).toBe(true)
      expect(regex.test('file12.txt')).toBe(false)
    })
  })

  describe('character classes', () => {
    it('should match [a-z]', () => {
      const regex = globToRegex('file[0-9].txt')
      expect(regex.test('file1.txt')).toBe(true)
      expect(regex.test('filea.txt')).toBe(false)
    })

    it('should match negated class [!a-z]', () => {
      const regex = globToRegex('file[!0-9].txt')
      expect(regex.test('file1.txt')).toBe(false)
      expect(regex.test('filea.txt')).toBe(true)
    })

    it('should match [^a-z] (alternate negation)', () => {
      const regex = globToRegex('file[^0-9].txt')
      expect(regex.test('file1.txt')).toBe(false)
      expect(regex.test('filea.txt')).toBe(true)
    })

    it('should handle ranges correctly', () => {
      const regex = globToRegex('[a-c].txt')
      expect(regex.test('a.txt')).toBe(true)
      expect(regex.test('b.txt')).toBe(true)
      expect(regex.test('c.txt')).toBe(true)
      expect(regex.test('d.txt')).toBe(false)
    })
  })

  describe('extglob patterns', () => {
    it('should match @(a|b) - exactly one', () => {
      const regex = globToRegex('file.@(txt|md)')
      expect(regex.test('file.txt')).toBe(true)
      expect(regex.test('file.md')).toBe(true)
      expect(regex.test('file.js')).toBe(false)
    })

    it('should match *(a|b) - zero or more', () => {
      const regex = globToRegex('prefix*(a|b)')
      expect(regex.test('prefix')).toBe(true)
      expect(regex.test('prefixa')).toBe(true)
      expect(regex.test('prefixbab')).toBe(true)
      expect(regex.test('prefixc')).toBe(false)
    })

    it('should match +(a|b) - one or more', () => {
      const regex = globToRegex('prefix+(a|b)')
      expect(regex.test('prefix')).toBe(false)
      expect(regex.test('prefixa')).toBe(true)
      expect(regex.test('prefixbab')).toBe(true)
    })

    it('should match ?(a|b) - zero or one', () => {
      const regex = globToRegex('prefix?(a|b)')
      expect(regex.test('prefix')).toBe(true)
      expect(regex.test('prefixa')).toBe(true)
      expect(regex.test('prefixaa')).toBe(false)
    })

    it('should match !(a|b) - anything except', () => {
      const regex = globToRegex('file!(txt|md)')
      expect(regex.test('filetxt')).toBe(false)
      expect(regex.test('filemd')).toBe(false)
      expect(regex.test('filejs')).toBe(true)
    })
  })

  describe('negated patterns', () => {
    it('should negate with leading !', () => {
      const regex = globToRegex('!*.txt')
      expect(regex.test('file.txt')).toBe(false)
      expect(regex.test('file.md')).toBe(true)
    })

    it('should combine negation with complex patterns', () => {
      const regex = globToRegex('!src/**/*.test.ts')
      expect(regex.test('src/file.test.ts')).toBe(false)
      expect(regex.test('src/file.ts')).toBe(true)
      expect(regex.test('lib/file.test.ts')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should escape regex special chars', () => {
      const regex = globToRegex('file.(1).txt')
      expect(regex.test('file.(1).txt')).toBe(true)
    })

    it('should handle empty patterns', () => {
      const regex = globToRegex('')
      expect(regex.test('')).toBe(true)
      expect(regex.test('anything')).toBe(false)
    })

    it('should handle patterns with only wildcards', () => {
      const regex = globToRegex('**')
      expect(regex.test('')).toBe(true)
      expect(regex.test('a')).toBe(true)
      expect(regex.test('a/b/c')).toBe(true)
    })
  })
})

describe('testPath', () => {
  it('should return true for matching paths', () => {
    expect(testPath('src/file.txt', '*.txt')).toBe(false)
    expect(testPath('file.txt', '*.txt')).toBe(true)
    expect(testPath('src/nested/file.txt', '**/*.txt')).toBe(true)
  })

  it('should handle negated patterns', () => {
    expect(testPath('file.txt', '!*.txt')).toBe(false)
    expect(testPath('file.md', '!*.txt')).toBe(true)
  })
})

describe('compileGlob', () => {
  it('should return matcher with isNegated flag', () => {
    const matcher = compileGlob('*.txt')
    expect(matcher.isNegated).toBe(false)
    expect(matcher.pattern).toBe('*.txt')
  })

  it('should detect negated patterns', () => {
    const matcher = compileGlob('!*.txt')
    expect(matcher.isNegated).toBe(true)
    expect(matcher.pattern).toBe('*.txt')
  })
})

describe('expandBraces', () => {
  it('should expand simple braces', () => {
    const result = expandBraces('file.{txt,md}')
    expect(result).toEqual(['file.txt', 'file.md'])
  })

  it('should expand multiple braces', () => {
    const result = expandBraces('{src,lib}/file.{ts,js}')
    expect(result).toContain('src/file.ts')
    expect(result).toContain('src/file.js')
    expect(result).toContain('lib/file.ts')
    expect(result).toContain('lib/file.js')
  })

  it('should expand nested braces', () => {
    const result = expandBraces('file.{a,{b,c}}')
    expect(result).toContain('file.a')
    expect(result).toContain('file.b')
    expect(result).toContain('file.c')
  })

  it('should handle empty braces', () => {
    const result = expandBraces('file.{}')
    expect(result).toEqual(['file.'])
  })

  it('should handle non-braced strings', () => {
    const result = expandBraces('simple-file.txt')
    expect(result).toEqual(['simple-file.txt'])
  })

  it('should handle spaces in braces', () => {
    const result = expandBraces('file.{ a , b , c }')
    expect(result).toEqual(['file. a ', 'file. b ', 'file. c '])
  })
})

describe('real-world patterns', () => {
  it('should match all markdown files', () => {
    const regex = globToRegex('**/*.md')
    expect(regex.test('README.md')).toBe(true)
    expect(regex.test('docs/guide.md')).toBe(true)
    expect(regex.test('src/nested/deep/file.md')).toBe(true)
    expect(regex.test('file.txt')).toBe(false)
  })

  it('should match test files', () => {
    const regex = globToRegex('**/*.test.ts')
    expect(regex.test('file.test.ts')).toBe(true)
    expect(regex.test('src/component.test.ts')).toBe(true)
    expect(regex.test('file.ts')).toBe(false)
  })

  it('should match node_modules exclusion', () => {
    const regex = globToRegex('!node_modules/**')
    expect(regex.test('node_modules/package/index.js')).toBe(false)
    expect(regex.test('src/index.js')).toBe(true)
  })

  it('should match specific file patterns', () => {
    const regex = globToRegex('@(package|tsconfig|tsup).json')
    expect(regex.test('package.json')).toBe(true)
    expect(regex.test('tsconfig.json')).toBe(true)
    expect(regex.test('tsup.config.ts')).toBe(false)
  })
})
