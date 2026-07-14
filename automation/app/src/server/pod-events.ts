import { getScenario } from './store.js'
import { Pod, PodWaking } from './lib/pod-client.js'
import { emit } from './bus.js'

/** Refcounted per-scenario poller for live pod session events (the THING trace). */
const pollers = new Map<string, { ref: number; stop: () => void }>()

export function refPoller(scenarioId: string) {
  const existing = pollers.get(scenarioId)
  if (existing) {
    existing.ref++
    return
  }
  const ctrl = { ref: 1, stop: () => {} }
  pollers.set(scenarioId, ctrl)
  start(scenarioId, ctrl)
}

export function unrefPoller(scenarioId: string) {
  const p = pollers.get(scenarioId)
  if (!p) return
  p.ref--
  if (p.ref <= 0) {
    p.stop()
    pollers.delete(scenarioId)
  }
}

function start(scenarioId: string, ctrl: { ref: number; stop: () => void }) {
  let stopped = false
  let since = 0
  ctrl.stop = () => {
    stopped = true
  }
  const tick = async () => {
    if (stopped) return
    try {
      const sc = getScenario(scenarioId)
      const userId = sc?.user?.userId
      const sessionId = sc?.checkpoint?.sessionId
      if (userId && sessionId) {
        const pod = new Pod(userId)
        const ev = (await pod.sessionEvents(sessionId, since)) as any
        const events: any[] = ev?.events ?? (Array.isArray(ev) ? ev : [])
        if (events.length) {
          for (const e of events) since = Math.max(since, (e.seq ?? 0) + 1)
          emit(scenarioId, 'pod-events', events)
        }
      }
    } catch (e) {
      if (!(e instanceof PodWaking)) {
        // pod unreachable / session gone — stay quiet, retry next tick
      }
    }
    setTimeout(tick, 2000)
  }
  setTimeout(tick, 0)
}
