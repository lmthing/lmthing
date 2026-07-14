import type {
  CampaignState,
  Checkpoint,
  RuntimeState,
  ScenarioData,
  AttemptArtifacts,
  PodBundle,
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

/** Resolve the scenario a pod userId belongs to (pod-proxy routes are keyed by userId). */
export function getScenarioByUserId(userId: string): ScenarioData | undefined {
  for (const s of store.scenarios.values()) if (s.user?.userId === userId) return s
  return undefined
}

/**
 * Replace the fs/app parts of a local scenario's pushed pod snapshot. Events are
 * managed separately (addPodEvents) so a full-bundle re-push doesn't drop the live
 * event tail the SSE viewers have already seen.
 */
export function setPodBundle(
  id: string,
  b: Omit<PodBundle, 'updatedAt' | 'events'> & { events?: unknown[] },
) {
  const s = ensureScenario(id)
  const prev = s.podBundle
  s.podBundle = {
    projectId: b.projectId,
    tree: b.tree,
    files: b.files,
    manifest: b.manifest,
    app: b.app,
    events: b.events ?? prev?.events ?? [],
    updatedAt: Date.now(),
  }
  s.updatedAt = Date.now()
  emit(id, 'pod-bundle', { projectId: b.projectId, tree: b.tree, updatedAt: s.podBundle.updatedAt })
}

/**
 * Append THING session-trace events to a local scenario's bundle + live-broadcast the
 * new ones. `reset` clears prior events first — the client sends it when the session
 * id changes (a re-run restarts seqs at 1, which dedup would otherwise drop).
 */
export function addPodEvents(id: string, events: unknown[], reset = false) {
  if (!events.length && !reset) return
  const s = ensureScenario(id)
  const bundle: PodBundle =
    s.podBundle ?? { projectId: s.checkpoint?.projectId ?? id, tree: [], files: {}, events: [], updatedAt: Date.now() }
  if (reset) bundle.events = []
  const seen = new Set(bundle.events.map((e) => (e as { seq?: number })?.seq))
  const fresh = events.filter((e) => {
    const seq = (e as { seq?: number })?.seq
    return seq === undefined || !seen.has(seq)
  })
  bundle.events = [...bundle.events, ...fresh].slice(-5000)
  bundle.updatedAt = Date.now()
  s.podBundle = bundle
  s.updatedAt = Date.now()
  // On reset, tell viewers to clear even if this first batch was empty.
  if (fresh.length || reset) emit(id, 'pod-events', { events: fresh, reset })
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
