/**
 * Tiny in-process event bus. Ingest handlers emit; the SSE endpoint subscribes.
 * A scenarioId of '*' is the overview channel (live cost/status/ledger deltas).
 */
export interface DashEvent {
  event: string
  data: unknown
}

type Listener = (ev: DashEvent) => void

const channels = new Map<string, Set<Listener>>()

export function subscribe(channel: string, fn: Listener): () => void {
  let set = channels.get(channel)
  if (!set) {
    set = new Set()
    channels.set(channel, set)
  }
  set.add(fn)
  return () => {
    set?.delete(fn)
    if (set && set.size === 0) channels.delete(channel)
  }
}

export function emit(channel: string, event: string, data: unknown) {
  const set = channels.get(channel)
  if (!set) return
  const ev: DashEvent = { event, data }
  for (const fn of set) {
    try {
      fn(ev)
    } catch {
      /* a dead listener — the SSE handler cleans up on abort */
    }
  }
}
