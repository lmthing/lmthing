/** Read local artifacts and push snapshots to the app. */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { instanceDir, scenarioDir, attemptDir, SCENARIOS_DIR } from './paths.mjs'
import { readJson, readUsers, scenarioLabel } from './mapping.mjs'

function readText(file) {
  if (!existsSync(file)) return undefined
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
}

export function makeSnapshot({ instance, push }) {
  const inst = instanceDir(instance)

  async function syncState() {
    const state = readJson(resolve(inst, 'state.json'))
    if (state) await push.post('/state', state)
    return state
  }

  async function syncRuntime() {
    const rt = readJson(resolve(inst, 'state/runtime.json'))
    if (rt) await push.post('/runtime', rt)
    return rt
  }

  async function syncUsers() {
    const users = readUsers()
    await push.post('/users', users)
    return users
  }

  async function syncScenario(id) {
    const dir = scenarioDir(id)
    if (!existsSync(dir)) return
    const md = readText(resolve(dir, 'scenario.md'))
    if (md) await push.post(`/scenario-md/${id}`, { md })
    const cp = readJson(resolve(dir, 'results/checkpoint.json'))
    if (cp) {
      await push.post(`/checkpoint/${id}`, cp)
      // backfill the label→userId mapping into the users view if missing
      if (cp.user?.label && cp.user?.userId) {
        // the /users push is the source of truth; nothing to do here
      }
    }
  }

  /** Push all attempts' static artifacts (result/output.log/prompt.md/PROGRESS.md). */
  async function syncAttempts(id) {
    const roundsRoot = resolve(inst, 'rounds')
    if (!existsSync(roundsRoot)) return
    for (const rStr of readdirSync(roundsRoot)) {
      const rDir = resolve(roundsRoot, rStr)
      const taskDir = resolve(rDir, id)
      if (!existsSync(taskDir)) continue
      const roundNum = Number(rStr)
      for (const entry of readdirSync(taskDir)) {
        const m = /^attempt-(\d+)$/.exec(entry)
        if (!m) continue
        const attempt = Number(m[1])
        const aDir = attemptDir(instance, roundNum, id, attempt)
        const art = {}
        const result = readJson(resolve(aDir, 'result.json'))
        if (result) art.result = result
        const outLog = readText(resolve(aDir, 'output.log'))
        if (outLog) art.outputLog = outLog
        const promptMd = readText(resolve(aDir, 'prompt.md'))
        if (promptMd) art.promptMd = promptMd
        const progressMd = readText(resolve(taskDir, 'PROGRESS.md'))
        if (progressMd) art.progressMd = progressMd
        await push.post(`/attempt/${id}/${roundNum}/${attempt}`, art)
      }
    }
  }

  /** Push everything. Used on start / reconnect. */
  async function syncAll() {
    const state = await syncState()
    await syncRuntime()
    await syncUsers()
    const ids = new Set(Object.keys(state?.tasks ?? {}))
    // also include scenarios that exist on disk but aren't in the ledger yet.
    if (existsSync(SCENARIOS_DIR)) {
      for (const f of readdirSync(SCENARIOS_DIR)) {
        if (/^\d+-/.test(f)) ids.add(f)
      }
    }
    for (const id of ids) {
      await syncScenario(id)
      await syncAttempts(id)
    }
    console.log(`[snapshot] synced ${ids.size} scenarios`)
  }

  return { syncState, syncRuntime, syncUsers, syncScenario, syncAttempts, syncAll }
}
