/** Resolve a scenario id → { label, userId } from checkpoint (preferred) or users files. */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { scenarioDir, HARNESS_USERS_DIR } from './paths.mjs'

export function readJson(file) {
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export function readUsers() {
  const out = {}
  if (!existsSync(HARNESS_USERS_DIR)) return out
  for (const f of readdirSync(HARNESS_USERS_DIR)) {
    if (!f.endsWith('.json')) continue
    const label = f.replace(/\.json$/, '')
    const u = readJson(resolve(HARNESS_USERS_DIR, f))
    if (u?.userId) out[label] = { userId: u.userId, email: u.email }
  }
  return out
}

/**
 * The label that maps a scenario to a user. checkpoint.user.label is authoritative;
 * otherwise fall back to the scenario id itself (common convention) then known users.
 */
export function scenarioLabel(id, checkpoint) {
  if (checkpoint?.user?.label) return checkpoint.user.label
  return id
}
