import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { listScenarios, getScenario, getCampaign, getRuntime } from '../store.js'
import { subscribe } from '../bus.js'
import { refPoller, unrefPoller } from '../pod-events.js'

export const scenariosRouter = new Hono()

scenariosRouter.get('/', (c) => {
  return c.json({
    campaign: getCampaign(),
    runtime: getRuntime(),
    scenarios: listScenarios().map((s) => ({
      id: s.id,
      round: getCampaign()?.tasks?.[s.id]?.round,
      user: s.user,
      checkpoint: s.checkpoint
        ? {
            projectId: s.checkpoint.projectId,
            sessionId: s.checkpoint.sessionId,
            done: s.checkpoint.done,
            summary: s.checkpoint.summary,
          }
        : undefined,
      attempts: Object.keys(s.attempts).length,
      updatedAt: s.updatedAt,
    })),
  })
})

scenariosRouter.get('/:id', (c) => {
  const s = getScenario(c.req.param('id'))
  if (!s) return c.json({ error: 'not found' }, 404)
  // Merge in the campaign round so the detail header can show it (ScenarioData
  // itself doesn't carry the ledger).
  return c.json({ ...s, campaignState: getCampaign() })
})

/**
 * Server-Sent Events: live updates for one scenario (or '*' for the overview).
 * Re-broadcasts ingest deltas (transcript/runtime/checkpoint) + polled pod session
 * events. Token is via ?token= (EventSource cannot set headers).
 */
scenariosRouter.get('/events/:id', async (c) => {
  const id = c.req.param('id')
  const sc = id === '*' ? null : getScenario(id)

  return streamSSE(c, async (stream) => {
    // Initial snapshot so a fresh view paints immediately.
    if (id === '*') {
      await stream.writeSSE({ event: 'snapshot', data: JSON.stringify({ campaign: getCampaign(), runtime: getRuntime() }) })
    } else if (sc) {
      await stream.writeSSE({ event: 'snapshot', data: JSON.stringify(sc) })
    }

    const queue: { event: string; data: unknown }[] = []
    let resolveDrain: (() => void) | null = null
    const enqueue = (ev: { event: string; data: unknown }) => {
      queue.push(ev)
      resolveDrain?.()
      resolveDrain = null
    }
    const unsub = subscribe(id, (ev) => enqueue(ev))

    if (id !== '*' && sc?.user?.userId && sc?.checkpoint?.sessionId) refPoller(id)

    const abort = c.req.raw.signal
    const keep = setInterval(() => enqueue({ event: 'ping', data: String(Date.now()) }), 15000)

    const closed = new Promise<void>((resolve) => {
      if (abort.aborted) resolve()
      else abort.addEventListener('abort', () => resolve(), { once: true })
    })

    try {
      while (!abort.aborted) {
        if (!queue.length) {
          const next = new Promise<void>((r) => (resolveDrain = r))
          await Promise.race([next, closed])
        }
        while (queue.length) {
          const ev = queue.shift()!
          await stream.writeSSE({ event: ev.event, data: typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data) })
        }
        if (abort.aborted) break
      }
    } finally {
      clearInterval(keep)
      unsub()
      if (id !== '*' && sc?.user?.userId && sc?.checkpoint?.sessionId) unrefPoller(id)
    }
  })
})
