export type BlockDecayState = 'full' | 'keys' | 'count' | 'removed'
export type BlockCollapseState = 'expanded' | 'collapsed'

export interface BlockState {
  id: string
  collapseState: BlockCollapseState
  decayState: BlockDecayState
}

export function createBlockState(id: string): BlockState {
  return {
    id,
    collapseState: 'expanded',
    decayState: 'full',
  }
}

export function toggleCollapse(state: BlockState): BlockState {
  return {
    ...state,
    collapseState: state.collapseState === 'expanded' ? 'collapsed' : 'expanded',
  }
}

export function applyDecay(state: BlockState, distance: number, tiers: { full: number; keysOnly: number; summary: number }): BlockState {
  let decayState: BlockDecayState
  if (distance <= tiers.full) {
    decayState = 'full'
  } else if (distance <= tiers.keysOnly) {
    decayState = 'keys'
  } else if (distance <= tiers.summary) {
    decayState = 'count'
  } else {
    decayState = 'removed'
  }
  return { ...state, decayState }
}
