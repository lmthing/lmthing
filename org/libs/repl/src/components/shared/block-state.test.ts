import { describe, it, expect } from 'vitest'
import { createBlockState, toggleCollapse, applyDecay } from './block-state'

describe('components/shared/block-state', () => {
  it('creates default block state', () => {
    const state = createBlockState('b1')
    expect(state.id).toBe('b1')
    expect(state.collapseState).toBe('expanded')
    expect(state.decayState).toBe('full')
  })

  it('toggles collapse state', () => {
    const state = createBlockState('b1')
    const collapsed = toggleCollapse(state)
    expect(collapsed.collapseState).toBe('collapsed')
    const expanded = toggleCollapse(collapsed)
    expect(expanded.collapseState).toBe('expanded')
  })

  it('does not mutate original state on toggle', () => {
    const state = createBlockState('b1')
    toggleCollapse(state)
    expect(state.collapseState).toBe('expanded')
  })

  describe('applyDecay', () => {
    const tiers = { full: 2, keysOnly: 5, summary: 10 }

    it('returns full for distance 0-2', () => {
      expect(applyDecay(createBlockState('b1'), 0, tiers).decayState).toBe('full')
      expect(applyDecay(createBlockState('b1'), 1, tiers).decayState).toBe('full')
      expect(applyDecay(createBlockState('b1'), 2, tiers).decayState).toBe('full')
    })

    it('returns keys for distance 3-5', () => {
      expect(applyDecay(createBlockState('b1'), 3, tiers).decayState).toBe('keys')
      expect(applyDecay(createBlockState('b1'), 5, tiers).decayState).toBe('keys')
    })

    it('returns count for distance 6-10', () => {
      expect(applyDecay(createBlockState('b1'), 6, tiers).decayState).toBe('count')
      expect(applyDecay(createBlockState('b1'), 10, tiers).decayState).toBe('count')
    })

    it('returns removed for distance 11+', () => {
      expect(applyDecay(createBlockState('b1'), 11, tiers).decayState).toBe('removed')
      expect(applyDecay(createBlockState('b1'), 100, tiers).decayState).toBe('removed')
    })
  })
})
