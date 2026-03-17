import type { StopPayload, SerializedValue } from '../session/types'

export interface DecayTiers {
  full: number
  keysOnly: number
  summary: number
}

const DEFAULT_TIERS: DecayTiers = { full: 2, keysOnly: 5, summary: 10 }

export type DecayLevel = 'full' | 'keys' | 'count' | 'removed'

/**
 * Determine decay level based on distance from current turn.
 */
export function getDecayLevel(distance: number, tiers: DecayTiers = DEFAULT_TIERS): DecayLevel {
  if (distance <= tiers.full) return 'full'
  if (distance <= tiers.keysOnly) return 'keys'
  if (distance <= tiers.summary) return 'count'
  return 'removed'
}

/**
 * Apply decay to a stop payload string based on distance.
 */
export function decayStopPayload(
  payload: StopPayload,
  distance: number,
  tiers: DecayTiers = DEFAULT_TIERS,
): string | null {
  const level = getDecayLevel(distance, tiers)

  switch (level) {
    case 'full':
      return formatFullPayload(payload)
    case 'keys':
      return formatKeysPayload(payload)
    case 'count':
      return formatCountPayload(payload)
    case 'removed':
      return null
  }
}

function formatFullPayload(payload: StopPayload): string {
  const entries = Object.entries(payload).map(([key, sv]) => `${key}: ${sv.display}`)
  return `← stop { ${entries.join(', ')} }`
}

function formatKeysPayload(payload: StopPayload): string {
  const entries = Object.entries(payload).map(([key, sv]) => {
    const type = describeValueType(sv)
    return `${key}: ${type}`
  })
  return `← stop { ${entries.join(', ')} }`
}

function formatCountPayload(payload: StopPayload): string {
  const count = Object.keys(payload).length
  return `← stop (${count} value${count === 1 ? '' : 's'} read)`
}

function describeValueType(sv: SerializedValue): string {
  const val = sv.value
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (Array.isArray(val)) return `Array(${val.length})`
  if (typeof val === 'object') {
    const keys = Object.keys(val as object)
    return `Object{${keys.join(',')}}`
  }
  return typeof val
}

/**
 * Apply decay to an error payload message.
 */
export function decayErrorMessage(
  errorMsg: string,
  distance: number,
  tiers: DecayTiers = DEFAULT_TIERS,
): string | null {
  const level = getDecayLevel(distance, tiers)
  if (level === 'removed') return null
  if (level === 'count') return '← error (1 error occurred)'
  return errorMsg
}
