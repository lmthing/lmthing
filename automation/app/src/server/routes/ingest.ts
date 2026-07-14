import { Hono } from 'hono'
import type { CampaignState, RuntimeState, Checkpoint, PodBundle } from '../../shared/types.js'
import {
  setCampaign,
  setRuntime,
  setUsers,
  setCheckpoint,
  setScenarioMd,
  setAttemptArtifacts,
  appendTranscriptLines,
  setPodBundle,
  addPodEvents,
} from '../store.js'

// All ingest routes are mounted under tokenGate (applied by the parent app).
export const ingestRouter = new Hono()

ingestRouter.post('/state', async (c) => {
  const state = (await c.req.json()) as CampaignState
  setCampaign(state)
  return c.json({ ok: true })
})

ingestRouter.post('/runtime', async (c) => {
  const rt = (await c.req.json()) as RuntimeState
  setRuntime(rt)
  return c.json({ ok: true })
})

ingestRouter.post('/users', async (c) => {
  const users = (await c.req.json()) as Record<string, { userId?: string; email?: string }>
  setUsers(users)
  return c.json({ ok: true })
})

ingestRouter.post('/checkpoint/:id', async (c) => {
  const cp = (await c.req.json()) as Checkpoint
  setCheckpoint(c.req.param('id'), cp)
  return c.json({ ok: true })
})

ingestRouter.post('/scenario-md/:id', async (c) => {
  const { md } = (await c.req.json()) as { md: string }
  setScenarioMd(c.req.param('id'), md)
  return c.json({ ok: true })
})

ingestRouter.post('/attempt/:id/:round/:attempt', async (c) => {
  const art = (await c.req.json()) as Record<string, unknown>
  const round = Number(c.req.param('round'))
  const attempt = Number(c.req.param('attempt'))
  setAttemptArtifacts(c.req.param('id'), round, attempt, art)
  return c.json({ ok: true })
})

ingestRouter.post('/transcript/:id/:round/:attempt', async (c) => {
  const { lines } = (await c.req.json()) as { lines: unknown[] }
  const round = Number(c.req.param('round'))
  const attempt = Number(c.req.param('attempt'))
  appendTranscriptLines(c.req.param('id'), round, attempt, lines)
  return c.json({ ok: true })
})

// ── Local-pod data (client-pushed; the in-cluster app can't reach a NAT'd local pod) ──

/** Full fs/app snapshot of a local scenario's pod (fs tree + text files + manifest + served app). */
ingestRouter.post('/pod/:id', async (c) => {
  const b = (await c.req.json()) as Omit<PodBundle, 'updatedAt'>
  setPodBundle(c.req.param('id'), b)
  return c.json({ ok: true })
})

/** Incremental THING session-trace events for a local scenario (live-broadcast to viewers). */
ingestRouter.post('/pod-events/:id', async (c) => {
  const { events } = (await c.req.json()) as { events: unknown[] }
  addPodEvents(c.req.param('id'), events ?? [])
  return c.json({ ok: true })
})
