import { describe, it, expect } from 'vitest'
import {
  getKnowledgeDecayLevel,
  isKnowledgeContent,
  tagAsKnowledge,
  decayKnowledgeValue,
  KNOWLEDGE_TAG,
} from './knowledge-decay'
import type { KnowledgeDecayTiers } from './knowledge-decay'

// ── getKnowledgeDecayLevel ────────────────────────────────────────────────────

describe('getKnowledgeDecayLevel', () => {
  it('returns "full" for distance 0', () => {
    expect(getKnowledgeDecayLevel(0)).toBe('full')
  })

  it('returns "full" at the full boundary (default tiers.full = 0)', () => {
    expect(getKnowledgeDecayLevel(0)).toBe('full')
  })

  it('returns "truncated" for distance 1', () => {
    expect(getKnowledgeDecayLevel(1)).toBe('truncated')
  })

  it('returns "truncated" for distance 2', () => {
    expect(getKnowledgeDecayLevel(2)).toBe('truncated')
  })

  it('returns "headers" for distance 3', () => {
    expect(getKnowledgeDecayLevel(3)).toBe('headers')
  })

  it('returns "headers" for distance 4', () => {
    expect(getKnowledgeDecayLevel(4)).toBe('headers')
  })

  it('returns "names" for distance 5', () => {
    expect(getKnowledgeDecayLevel(5)).toBe('names')
  })

  it('returns "names" for distance 100', () => {
    expect(getKnowledgeDecayLevel(100)).toBe('names')
  })

  it('respects custom tiers', () => {
    const tiers: KnowledgeDecayTiers = { full: 1, truncated: 3, headers: 6 }
    expect(getKnowledgeDecayLevel(0, tiers)).toBe('full')
    expect(getKnowledgeDecayLevel(1, tiers)).toBe('full')
    expect(getKnowledgeDecayLevel(2, tiers)).toBe('truncated')
    expect(getKnowledgeDecayLevel(3, tiers)).toBe('truncated')
    expect(getKnowledgeDecayLevel(4, tiers)).toBe('headers')
    expect(getKnowledgeDecayLevel(6, tiers)).toBe('headers')
    expect(getKnowledgeDecayLevel(7, tiers)).toBe('names')
  })
})

// ── tagAsKnowledge / isKnowledgeContent ──────────────────────────────────────

describe('tagAsKnowledge', () => {
  it('sets the KNOWLEDGE_TAG symbol on the object', () => {
    const obj = { domain: { field: 'value' } }
    const tagged = tagAsKnowledge(obj)
    expect((tagged as any)[KNOWLEDGE_TAG]).toBe(true)
  })

  it('returns the same object reference', () => {
    const obj = { x: 1 }
    expect(tagAsKnowledge(obj)).toBe(obj)
  })

  it('tag is non-enumerable (not visible in JSON.stringify)', () => {
    const obj = tagAsKnowledge({ a: 1 })
    const json = JSON.stringify(obj)
    expect(json).toBe('{"a":1}')
    expect(json).not.toContain('lmthing:knowledge')
  })

  it('tag is not configurable (cannot be overwritten)', () => {
    const obj = tagAsKnowledge({})
    expect(() => {
      Object.defineProperty(obj, KNOWLEDGE_TAG, { value: false })
    }).toThrow()
  })
})

describe('isKnowledgeContent', () => {
  it('returns true for a tagged object', () => {
    const tagged = tagAsKnowledge({ space: { domain: { field: 'md' } } })
    expect(isKnowledgeContent(tagged)).toBe(true)
  })

  it('returns false for a plain (untagged) object', () => {
    expect(isKnowledgeContent({ a: 1 })).toBe(false)
  })

  it('returns false for null', () => {
    expect(isKnowledgeContent(null)).toBe(false)
  })

  it('returns false for a string', () => {
    expect(isKnowledgeContent('hello')).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isKnowledgeContent(42)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isKnowledgeContent(undefined)).toBe(false)
  })
})

// ── decayKnowledgeValue ───────────────────────────────────────────────────────

const SAMPLE_CONTENT = {
  'my-space': {
    cuisine: {
      italian: '# Italian Cooking\n\n## Pasta\n\nDetailed instructions for pasta...\n\n## Pizza\n\nHow to make pizza.',
    },
  },
}

describe('decayKnowledgeValue — distance 0 (full)', () => {
  it('returns the full markdown content serialized as JSON string leaves', () => {
    const result = decayKnowledgeValue(SAMPLE_CONTENT, 0)
    expect(result).toContain('Italian Cooking')
    expect(result).toContain('Detailed instructions for pasta')
    expect(result).toContain('How to make pizza')
    expect(result).toContain('"my-space"')
    expect(result).toContain('"cuisine"')
    expect(result).toContain('"italian"')
  })
})

describe('decayKnowledgeValue — distance 1 (truncated)', () => {
  it('truncates long content to ~300 chars with a truncation note', () => {
    const longContent = {
      space: {
        domain: {
          field: 'A'.repeat(400),
        },
      },
    }
    const result = decayKnowledgeValue(longContent, 1)
    expect(result).toContain('truncated')
    expect(result).toContain('400 chars')
  })

  it('does not truncate content that is 300 chars or fewer', () => {
    const shortContent = {
      space: {
        domain: {
          field: 'Short content under limit.',
        },
      },
    }
    const result = decayKnowledgeValue(shortContent, 1)
    expect(result).toContain('Short content under limit.')
    expect(result).not.toContain('truncated')
  })

  it('distance 2 also truncates', () => {
    const result = decayKnowledgeValue({ s: { d: { f: 'X'.repeat(500) } } }, 2)
    expect(result).toContain('truncated')
  })
})

describe('decayKnowledgeValue — distance 3 (headers)', () => {
  it('extracts markdown headings joined by " | "', () => {
    const result = decayKnowledgeValue(SAMPLE_CONTENT, 3)
    expect(result).toContain('# Italian Cooking')
    expect(result).toContain('## Pasta')
    expect(result).toContain('## Pizza')
    expect(result).toContain(' | ')
  })

  it('returns "(no headings)" for content with no headings', () => {
    const noHeadings = { space: { domain: { field: 'Just plain text, no headings at all.' } } }
    const result = decayKnowledgeValue(noHeadings, 3)
    expect(result).toContain('(no headings)')
  })

  it('does not include body text in headers output', () => {
    const result = decayKnowledgeValue(SAMPLE_CONTENT, 3)
    expect(result).not.toContain('Detailed instructions')
    expect(result).not.toContain('How to make pizza')
  })

  it('distance 4 also shows headers only', () => {
    const result = decayKnowledgeValue(SAMPLE_CONTENT, 4)
    expect(result).toContain('# Italian Cooking')
    expect(result).not.toContain('Detailed instructions')
  })
})

describe('decayKnowledgeValue — distance 5+ (names)', () => {
  it('returns "[knowledge: path]" format with slash-separated paths', () => {
    const result = decayKnowledgeValue(SAMPLE_CONTENT, 5)
    expect(result).toMatch(/\[knowledge:/)
    expect(result).toContain('my-space/cuisine/italian')
  })

  it('does not contain markdown content', () => {
    const result = decayKnowledgeValue(SAMPLE_CONTENT, 10)
    expect(result).not.toContain('Italian Cooking')
    expect(result).not.toContain('Pasta')
  })

  it('handles multiple leaf paths', () => {
    const multi = {
      space: {
        domain: {
          a: 'content a',
          b: 'content b',
        },
      },
    }
    const result = decayKnowledgeValue(multi, 5)
    expect(result).toContain('space/domain/a')
    expect(result).toContain('space/domain/b')
  })
})

describe('decayKnowledgeValue — nested structure', () => {
  it('handles deeply nested multi-level structure', () => {
    const deep = {
      s1: { d1: { f1: 'content 1' } },
      s2: { d2: { f2: 'content 2' } },
    }
    // Full mode includes both
    const full = decayKnowledgeValue(deep, 0)
    expect(full).toContain('content 1')
    expect(full).toContain('content 2')
    expect(full).toContain('"s1"')
    expect(full).toContain('"s2"')

    // Names mode includes both paths
    const names = decayKnowledgeValue(deep, 5)
    expect(names).toContain('s1/d1/f1')
    expect(names).toContain('s2/d2/f2')
  })
})
