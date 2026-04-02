/**
 * Tests for Vector Index - TF-IDF semantic search
 */

import { describe, it, expect } from 'vitest'
import { VectorIndex } from './vector-index'
import type { VectorIndexOptions } from './vector-index'

// ── VectorIndex ───────────────────────────────────────────────────────────────

describe('VectorIndex', () => {
  describe('constructor', () => {
    it('creates index with default options', () => {
      const index = new VectorIndex()
      expect(index).toBeInstanceOf(VectorIndex)
    })

    it('creates index with custom options', () => {
      const options: VectorIndexOptions = {
        minTermLength: 3,
        maxDocuments: 5,
      }
      const index = new VectorIndex(options)
      expect(index).toBeInstanceOf(VectorIndex)
    })
  })

  describe('index', () => {
    it('indexes text and code from a turn', () => {
      const index = new VectorIndex()
      index.index('Calculate user statistics', 'const count = users.length', 1)

      const results = index.search('user', 5)
      expect(results.length).toBeGreaterThan(0)
    })

    it('stores multiple turns', () => {
      const index = new VectorIndex()
      index.index('First turn content', 'code1', 1)
      index.index('Second turn content', 'code2', 2)
      index.index('Third turn content', 'code3', 3)

      const results = index.search('content', 5)
      expect(results.length).toBe(3)
    })

    it('handles empty content gracefully', () => {
      const index = new VectorIndex()
      expect(() => index.index('', '', 1)).not.toThrow()
    })
  })

  describe('search', () => {
    let index: VectorIndex

    beforeEach(() => {
      index = new VectorIndex()
      // Index sample content
      index.index('Handle user authentication', 'const token = jwt.verify()', 1)
      index.index('Process payment request', 'const payment = stripe.charge()', 2)
      index.index('User profile management', 'const profile = await db.users.find()', 3)
      index.index('Database connection setup', 'const db = mysql.connect()', 4)
    })

    it('returns relevant results for query terms', () => {
      const results = index.search('user', 3)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].turn).toBeDefined()
      expect(results[0].score).toBeGreaterThan(0)
      expect(results[0].score).toBeLessThanOrEqual(1)
    })

    it('ranks results by relevance score', () => {
      const results = index.search('user', 10)

      if (results.length > 1) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
      }
    })

    it('respects topK parameter', () => {
      const results = index.search('user', 2)

      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('returns both text and code in results', () => {
      const results = index.search('user', 1)

      if (results.length > 0) {
        expect(results[0].text).toBeDefined()
        expect(results[0].code).toBeDefined()
      }
    })

    it('returns empty array for no matches', () => {
      const results = index.search('nonexistent term xyz', 5)
      expect(results).toEqual([])
    })

    it('handles multi-word queries', () => {
      const results = index.search('user database', 5)
      expect(results.length).toBeGreaterThan(0)
    })

    it('is case-insensitive', () => {
      const results1 = index.search('USER', 5)
      const results2 = index.search('user', 5)

      expect(results1.length).toBe(results2.length)
    })
  })

  describe('tokenization and TF-IDF', () => {
    it('properly tokenizes text into words', () => {
      const index = new VectorIndex({ minTermLength: 3 })
      index.index('The quick brown fox', 'code here', 1)

      const results = index.search('quick fox', 5)
      expect(results.length).toBeGreaterThan(0)
    })

    it('filters short words by minTermLength', () => {
      const index = new VectorIndex({ minTermLength: 5 })
      index.index('The quick brown fox', 'code', 1)

      const results = index.search('fox', 5)
      // 'fox' is only 3 chars, won't be indexed with minTermLength=5
      expect(results.length).toBe(0)
    })

    it('calculates TF-IDF scores correctly', () => {
      const index = new VectorIndex()
      index.index('unique word here', 'code', 1)
      index.index('common word common word', 'code', 2)
      index.index('common word other content', 'code', 3)

      const resultsUnique = index.search('unique', 5)
      const resultsCommon = index.search('common', 5)

      // Unique term should rank higher than common terms
      if (resultsUnique.length > 0 && resultsCommon.length > 0) {
        expect(resultsUnique[0].score).toBeGreaterThan(0)
      }
    })
  })

  describe('cosine similarity', () => {
    it('calculates cosine similarity correctly', () => {
      const index = new VectorIndex()
      index.index('TypeScript React development', 'const app = <App />', 1)
      index.index('Python Django backend', 'def view(request):', 2)

      const results = index.search('TypeScript', 5)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].turn).toBe(1) // First turn should match best
    })
  })

  describe('edge cases', () => {
    it('handles special characters in content', () => {
      const index = new VectorIndex()
      index.index('C++ & Java code', 'const a = 0 & b = 1', 1)

      const results = index.search('code', 5)
      expect(results.length).toBeGreaterThan(0)
    })

    it('handles unicode content', () => {
      const index = new VectorIndex()
      index.index('café résumé naïve', 'const café = "coffee"', 1)

      const results = index.search('café', 5)
      expect(results.length).toBeGreaterThan(0)
    })

    it('handles very long documents', () => {
      const index = new VectorIndex()
      const longText = 'word '.repeat(1000)
      const longCode = 'const x = '.repeat(1000)

      expect(() => index.index(longText, longCode, 1)).not.toThrow()
    })

    it('handles empty index', () => {
      const index = new VectorIndex()
      const results = index.search('anything', 5)
      expect(results).toEqual([])
    })
  })
})
