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
import { instanceDir, scenarioDir, SCENARIOS_DIR } from './lib/paths.mjs'
import { readJson } from './lib/mapping.mjs'

function parseArgs() {
  const out = { appUrl: process.env.DASH_APP_URL || 'http://localhost:3000', token: process.env.DASH_VIEW_TOKEN || '', instance: 'scenario-campaign', once: false }
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    if (a === '--app-url') out.appUrl = process.argv[++i]
    else if (a === '--token') out.token = process.argv[++i]
    else if (a === '--instance') out.instance = process.argv[++i]
    else if (a === '--once') out.once = true
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

  console.log(`[client] app=${args.appUrl} instance=${args.instance}`)
  await snap.syncAll()

  if (args.once) {
    // one-shot: also push current transcript tails of any active run
    const state = readJson(resolve(instanceDir(args.instance), 'state.json'))
    tailer.tailActive(state?.runs)
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
    const state = readJson(stateFile)
    const ids = new Set(Object.keys(state?.tasks ?? {}))
    if (existsSync(SCENARIOS_DIR)) {
      for (const f of readdirSync(SCENARIOS_DIR)) if (/^\d+-/.test(f)) ids.add(f)
    }
    return [...ids]
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

  console.log('[client] watching (state/runtime 2s, artifacts 4s, transcript tail 0.5s)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
