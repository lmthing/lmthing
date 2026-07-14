#!/usr/bin/env node
/**
 * scenario-dash client — runs on the machine that owns the campaign + scenario data,
 * and PUSHES snapshots + live transcript tails to the cluster-side dashboard.
 *
 *   node client.mjs --app-url https://lmthing.cloud --token <DASH_VIEW_TOKEN>
 *   node client.mjs --app-url http://localhost:3000 --token dev
 *
 * Zero deps (Node 24 global fetch). Watches via polling (robust on Linux).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { makePush } from './lib/push.mjs'
import { makeSnapshot } from './lib/snapshot.mjs'
import { makeTailer } from './lib/tailer.mjs'
import { makePodSync, localProjectIds } from './lib/pod.mjs'
import { instanceDir, scenarioDir, SCENARIOS_DIR } from './lib/paths.mjs'
import { readJson } from './lib/mapping.mjs'

function parseArgs() {
  const out = {
    appUrl: process.env.DASH_APP_URL || 'http://localhost:3000',
    token: process.env.DASH_VIEW_TOKEN || '',
    instance: 'scenario-campaign',
    // The local `lmthing serve` the campaign runs against (SCENARIO_TARGET=local).
    podUrl: process.env.DASH_POD_URL || `http://localhost:${process.env.LM_LOCAL_PORT || 8080}`,
    once: false,
  }
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    if (a === '--app-url') out.appUrl = process.argv[++i]
    else if (a === '--token') out.token = process.argv[++i]
    else if (a === '--instance') out.instance = process.argv[++i]
    else if (a === '--pod-url') out.podUrl = process.argv[++i]
    else if (a === '--once') out.once = true
  }
  return out
}

/** All scenario ids = ledger tasks ∪ on-disk `NN-*` scenario dirs. */
function scenarioIdsFrom(state) {
  const ids = new Set(Object.keys(state?.tasks ?? {}))
  if (existsSync(SCENARIOS_DIR)) {
    for (const f of readdirSync(SCENARIOS_DIR)) if (/^\d+-/.test(f)) ids.add(f)
  }
  return [...ids]
}

/** Resolve local scenarios from their checkpoints: { id, projectId, sessionId }. */
function localScenarios(ids) {
  const out = []
  for (const id of ids) {
    const cp = readJson(resolve(scenarioDir(id), 'results/checkpoint.json'))
    if (cp?.projectId) out.push({ id, projectId: cp.projectId, sessionId: cp.sessionId })
  }
  return out
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h
}

function fileHash(file) {
  if (!existsSync(file)) return 0
  try {
    return hash(readFileSync(file, 'utf8'))
  } catch {
    return 0
  }
}

async function main() {
  const args = parseArgs()
  if (!args.token) {
    console.error('error: --token (DASH_VIEW_TOKEN) is required')
    process.exit(1)
  }
  const push = makePush(args.appUrl, args.token)
  const snap = makeSnapshot({ instance: args.instance, push })
  const tailer = makeTailer({ instance: args.instance, push })
  const podSync = makePodSync({ base: args.podUrl, push })

  console.log(`[client] app=${args.appUrl} instance=${args.instance} pod=${args.podUrl}`)
  await snap.syncAll()

  // Mirror the local pod (fs + served app + session events) for every scenario whose
  // project exists on it. No-op when the local pod is down or all scenarios are cluster.
  async function syncPods(ids) {
    const localIds = await localProjectIds(args.podUrl)
    if (!localIds.size) return
    let n = 0
    for (const sc of localScenarios(ids)) {
      try {
        if (await podSync.syncOne(sc, localIds)) n++
      } catch (e) {
        console.warn(`[pod] ${sc.id} sync error: ${e.message}`)
      }
    }
    return n
  }

  if (args.once) {
    // one-shot: also push current transcript tails of any active run + a pod snapshot
    const state = readJson(resolve(instanceDir(args.instance), 'state.json'))
    tailer.tailActive(state?.runs)
    await syncPods(scenarioIdsFrom(state))
    process.exit(0)
  }

  // ── polling watchers ──────────────────────────────────────────────────────
  const inst = instanceDir(args.instance)
  const stateFile = resolve(inst, 'state.json')
  const runtimeFile = resolve(inst, 'state/runtime.json')
  let lastState = fileHash(stateFile)
  let lastRuntime = fileHash(runtimeFile)
  // scenario artifact hashes (scenario.md, checkpoint.json) keyed by scenario id
  const artifactHashes = new Map()

  function scenarioIds() {
    return scenarioIdsFrom(readJson(stateFile))
  }

  // 2s: state + runtime + active transcript tail
  setInterval(async () => {
    const sh = fileHash(stateFile)
    if (sh !== lastState) {
      lastState = sh
      const state = await snap.syncState()
      tailer.tailActive(state?.runs)
    } else {
      const state = readJson(stateFile)
      tailer.tailActive(state?.runs)
    }
    const rh = fileHash(runtimeFile)
    if (rh !== lastRuntime) {
      lastRuntime = rh
      await snap.syncRuntime()
    }
  }, 2000)

  // 4s: scenario artifacts (scenario.md, checkpoint.json) + attempt result/output.log
  setInterval(async () => {
    for (const id of scenarioIds()) {
      const sMd = resolve(scenarioDir(id), 'scenario.md')
      const cp = resolve(scenarioDir(id), 'results/checkpoint.json')
      const h = `${fileHash(sMd)}:${fileHash(cp)}`
      if (h !== artifactHashes.get(id)) {
        artifactHashes.set(id, h)
        await snap.syncScenario(id)
      }
    }
    for (const id of scenarioIds()) await snap.syncAttempts(id)
  }, 4000)

  // also kick an initial tail immediately + every 500ms for liveness
  const state0 = readJson(stateFile)
  setInterval(() => {
    const state = readJson(stateFile)
    tailer.tailActive(state?.runs)
  }, 500)
  tailer.tailActive(state0?.runs)

  // 4s: mirror the local pod (fs + served app + live session events) per scenario.
  let podBusy = false
  setInterval(async () => {
    if (podBusy) return
    podBusy = true
    try {
      await syncPods(scenarioIds())
    } finally {
      podBusy = false
    }
  }, 4000)
  syncPods(scenarioIds())

  console.log('[client] watching (state/runtime 2s, artifacts 4s, pod 4s, transcript tail 0.5s)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
