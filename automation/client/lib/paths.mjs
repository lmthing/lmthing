/** Locate the campaign instance, scenarios, and harness users dirs. */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url)) // …/automation/client/lib
export const REPO_ROOT = resolve(HERE, '../../..') // …/automation/client → automation → repo
export const AUTOMATION = resolve(REPO_ROOT, 'automation')
export const SCENARIOS_DIR = resolve(REPO_ROOT, 'sdk/org/scenarios')
export const HARNESS_USERS_DIR = resolve(SCENARIOS_DIR, 'harness/.state/users')

export function instanceDir(instance) {
  return resolve(AUTOMATION, 'instances', instance)
}

export function scenarioDir(id) {
  return resolve(SCENARIOS_DIR, id)
}

export function attemptDir(instance, round, task, attempt) {
  return resolve(instanceDir(instance), 'rounds', String(round), task, `attempt-${attempt}`)
}
