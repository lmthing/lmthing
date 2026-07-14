import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { k8sAvailable, streamPodLogs } from '../lib/k8s.js'

export const podLogsRouter = new Hono()

/** Recent + live-follow container stdout (the lmthing runtime log) via SSE. */
podLogsRouter.get('/:userId/stream', async (c) => {
  const userId = c.req.param('userId')
  if (!k8sAvailable()) {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: 'k8s API unavailable — runtime log is only reachable in-cluster' }) })
    })
  }
  return streamSSE(c, async (stream) => {
    const abort = c.req.raw.signal
    const queue: string[] = []
    let resolveDrain: (() => void) | null = null
    const enqueue = (line: string) => {
      queue.push(line)
      resolveDrain?.()
      resolveDrain = null
    }
    const closed = new Promise<void>((resolve) => {
      if (abort.aborted) resolve()
      else abort.addEventListener('abort', () => resolve(), { once: true })
    })
    // Tail recent history then follow.
    streamPodLogs(userId, { tail: 300, follow: true }, enqueue, abort).catch((e) =>
      enqueue(`[dash] pod log stream error: ${e.message}`),
    )
    try {
      while (!abort.aborted) {
        if (!queue.length) {
          const next = new Promise<void>((r) => (resolveDrain = r))
          await Promise.race([next, closed])
        }
        while (queue.length) {
          const line = queue.shift()!
          await stream.writeSSE({ event: 'log', data: line })
        }
      }
    } finally {
      // fetch aborts via the signal
    }
  })
})
