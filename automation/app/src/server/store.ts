import type {
  CampaignState,
  Checkpoint,
  RuntimeState,
  ScenarioData,
  AttemptArtifacts,
} from '../shared/types.js'
import { emit } from './bus.js'

interface Store {
  campaign: CampaignState | null
  runtime: RuntimeState | null
  /** label → { userId, email } (harness/.state/users). */
  users: Record<string, { userId?: string; email?: string }>
  scenarios: Map<string, ScenarioData>
}

const store: Store = {
  campaign: null,
  runtime: null,
  users: {},
  scenarios: new Map(),
}

export function getCampaign() {
  return store.campaign
}

export function getRuntime() {
  return store.runtime
}

export function setCampaign(state: CampaignState) {
  store.campaign = state
  // Ensure a ScenarioData exists for every task in the ledger.
  for (const id of Object.keys(state.tasks ?? {})) ensureScenario(id)
  emit('*', 'campaign', state)
}

export function setRuntime(rt: RuntimeState) {
  store.runtime = rt
  emit('*', 'runtime', rt)
}

export function setUsers(users: Store['users']) {
  store.users = users
  // Backfill scenario.user from the users map where a checkpoint hasn't set it.
  for (const [label, u] of Object.entries(users)) {
    for (const sc of store.scenarios.values()) {
      if (sc.user?.label === label || label === sc.id) {
        if (!sc.user?.userId && u.userId) {
          sc.user = { ...sc.user, label, userId: u.userId, email: u.email }
          sc.updatedAt = Date.now()
        }
      }
    }
  }
  emit('*', 'users', users)
}

export function ensureScenario(id: string): ScenarioData {
  let s = store.scenarios.get(id)
  if (!s) {
    s = { id, attempts: {}, updatedAt: Date.now() }
    store.scenarios.set(id, s)
  }
  return s
}

export function getScenario(id: string): ScenarioData | undefined {
  return store.scenarios.get(id)
}

export function listScenarios(): ScenarioData[] {
  return [...store.scenarios.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function setCheckpoint(id: string, cp: Checkpoint) {
  const s = ensureScenario(id)
  s.checkpoint = cp
  if (cp.user) {
    s.user = { ...s.user, ...cp.user }
  }
  s.updatedAt = Date.now()
  emit(id, 'checkpoint', cp)
  emit('*', 'scenario-summary', { id, checkpoint: cp })
}

export function setScenarioMd(id: string, md: string) {
  const s = ensureScenario(id)
  s.scenarioMd = md
  s.updatedAt = Date.now()
  emit(id, 'scenario-md', md)
}

export function setAttemptArtifacts(
  id: string,
  round: number,
  attempt: number,
  art: Partial<AttemptArtifacts>,
) {
  const s = ensureScenario(id)
  const key = `${round}:${attempt}`
  const existing: AttemptArtifacts = s.attempts[key] ?? { round, attempt, transcript: [] }
  s.attempts[key] = { ...existing, ...art, round, attempt }
  s.updatedAt = Date.now()
  emit(id, 'attempt', { round, attempt, artifacts: art })
}

export function appendTranscriptLines(
  id: string,
  round: number,
  attempt: number,
  lines: unknown[],
) {
  if (!lines.length) return
  const s = ensureScenario(id)
  const key = `${round}:${attempt}`
  const existing: AttemptArtifacts = s.attempts[key] ?? { round, attempt, transcript: [] }
  if (!existing.transcript) existing.transcript = []
  for (const l of lines) existing.transcript.push(l)
  // Cap the buffer so a runaway tail can't exhaust memory (older lines are in output.jsonl on disk).
  if (existing.transcript.length > 5000) {
    existing.transcript = existing.transcript.slice(-5000)
  }
  s.attempts[key] = existing
  s.updatedAt = Date.now()
  emit(id, 'transcript', { round, attempt, lines })
}

export function snapshot(): { campaign: CampaignState | null; runtime: RuntimeState | null } {
  return { campaign: store.campaign, runtime: store.runtime }
}
