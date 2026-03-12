// src/lib/fs/parsers/frontmatter.test.ts

import { describe, it, expect } from 'vitest'
import { parseFrontmatter, serializeFrontmatter } from './frontmatter'

describe('frontmatter parser', () => {
  describe('parseFrontmatter', () => {
    it('should parse simple YAML frontmatter', () => {
      const content = `---
title: Test
count: 42
---
Content here`
      const result = parseFrontmatter(content)

      expect(result.frontmatter).toEqual({ title: 'Test', count: 42 })
      expect(result.content).toBe('Content here')
    })

    it('should handle files without frontmatter', () => {
      const content = 'Just content'
      const result = parseFrontmatter(content)

      expect(result.frontmatter).toEqual({})
      expect(result.content).toBe('Just content')
      expect(result.raw).toBe('Just content')
    })

    it('should parse strings with quotes', () => {
      const content = `---
name: "John Doe"
---
Content`
      const result = parseFrontmatter(content)

      expect(result.frontmatter.name).toBe('John Doe')
    })

    it('should parse arrays', () => {
      const content = `---
tags: [a, b, c]
---
Content`
      const result = parseFrontmatter(content)

      expect(result.frontmatter.tags).toEqual(['a', 'b', 'c'])
    })

    it('should parse nested objects', () => {
      const content = `---
meta: { key: value }
---
Content`
      const result = parseFrontmatter(content)

      expect(result.frontmatter.meta).toEqual({ key: 'value' })
    })

    it('should parse booleans', () => {
      const content = `---
enabled: true
disabled: false
---
Content`
      const result = parseFrontmatter(content)

      expect(result.frontmatter.enabled).toBe(true)
      expect(result.frontmatter.disabled).toBe(false)
    })

    it('should parse null', () => {
      const content = `---
value: null
---
Content`
      const result = parseFrontmatter(content)

      expect(result.frontmatter.value).toBe(null)
    })

    it('should preserve content with newlines', () => {
      const content = `---
title: Test
---
Line 1
Line 2
Line 3`
      const result = parseFrontmatter(content)

      expect(result.content).toBe('Line 1\nLine 2\nLine 3')
    })
  })

  describe('serializeFrontmatter', () => {
    it('should serialize simple frontmatter', () => {
      const result = serializeFrontmatter({ title: 'Test', count: 42 }, 'Content')

      expect(result).toContain('---')
      expect(result).toContain('title: Test')
      expect(result).toContain('count: 42')
      expect(result).toContain('---')
      expect(result).toContain('Content')
    })

    it('should quote strings with special characters', () => {
      const result = serializeFrontmatter({ message: 'hello: world' }, 'Content')

      expect(result).toContain('message: "hello: world"')
    })

    it('should serialize arrays', () => {
      const result = serializeFrontmatter({ tags: ['a', 'b', 'c'] }, 'Content')

      expect(result).toContain('tags: [a, b, c]')
    })

    it('should serialize booleans correctly', () => {
      const result = serializeFrontmatter({ bool: true, nullVal: null }, 'Content')

      expect(result).toContain('bool: true')
      expect(result).toContain('nullVal: null')
    })

    it('should round-trip correctly', () => {
      const original = `---
title: My Post
tags: [js, ts]
published: true
---
This is the content`

      const parsed = parseFrontmatter(original)
      const serialized = serializeFrontmatter(parsed.frontmatter, parsed.content)
      const reparsed = parseFrontmatter(serialized)

      expect(reparsed.frontmatter).toEqual(parsed.frontmatter)
      expect(reparsed.content).toEqual(parsed.content)
    })
  })
})
