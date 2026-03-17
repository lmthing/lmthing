import { describe, it, expect } from 'vitest'
import { compressCodeWindow, buildSummaryComment } from './code-window'
import type { CodeTurn } from './code-window'

describe('context/code-window', () => {
  describe('compressCodeWindow', () => {
    it('returns all lines when under limit', () => {
      const turns: CodeTurn[] = [
        { lines: ['const x = 1', 'const y = 2'], declarations: ['x', 'y'], turnIndex: 1 },
      ]
      const result = compressCodeWindow(turns, 200)
      expect(result).toEqual(['const x = 1', 'const y = 2'])
    })

    it('returns empty for no turns', () => {
      expect(compressCodeWindow([], 200)).toEqual([])
    })

    it('summarizes old turns when over limit', () => {
      const turns: CodeTurn[] = [
        { lines: Array(100).fill('old code'), declarations: ['x'], turnIndex: 1 },
        { lines: Array(50).fill('mid code'), declarations: ['y'], turnIndex: 101 },
        { lines: Array(80).fill('new code'), declarations: ['z'], turnIndex: 151 },
      ]
      const result = compressCodeWindow(turns, 150)
      // Should summarize first turn, keep last two
      expect(result[0]).toContain('// [lines')
      expect(result[0]).toContain('declared: x')
      expect(result.filter(l => l === 'mid code')).toHaveLength(50)
      expect(result.filter(l => l === 'new code')).toHaveLength(80)
    })

    it('never summarizes most recent turn', () => {
      const turns: CodeTurn[] = [
        { lines: Array(100).fill('old'), declarations: [], turnIndex: 1 },
        { lines: Array(100).fill('new'), declarations: ['result'], turnIndex: 101 },
      ]
      const result = compressCodeWindow(turns, 100)
      expect(result.filter(l => l === 'new')).toHaveLength(100)
      expect(result[0]).toContain('// [lines')
    })
  })

  describe('buildSummaryComment', () => {
    it('builds summary with declarations', () => {
      const summary = buildSummaryComment(1, 50, ['x', 'y'])
      expect(summary).toBe('// [lines 1-50 executed] declared: x, y')
    })

    it('builds summary without declarations', () => {
      const summary = buildSummaryComment(1, 10, [])
      expect(summary).toBe('// [lines 1-10 executed]')
    })
  })
})
