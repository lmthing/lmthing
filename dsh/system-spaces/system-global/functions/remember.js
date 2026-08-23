import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

/**
 * Ported from sdk/org/libs/core/system-spaces/system-global/functions/remember.ts.
 * LMThing's version reads/writes through the sandbox's internal `readFileRaw`/
 * `writeFileRaw` host primitives; here it's plain Node fs, since dsh tools run
 * server-side with no sandbox distinction between "space-scoped" and generic
 * fs (see dsh/packages/README.md — a Phase 1 fidelity gap, not a silent one).
 */
const memoryPath = () => join(process.env['LMTHING_SPACE_DIR'] ?? '.', '.lmthing', 'memory.json')

function readStore() {
  try {
    return JSON.parse(readFileSync(memoryPath(), 'utf8'))
  } catch {
    return {}
  }
}

function writeStore(store) {
  const path = memoryPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(store, null, 2), 'utf8')
}

export const description = 'Persist a fact across sessions under a key (durable, space-scoped).'

export const schema = {
  key: { type: 'string', required: true, description: 'The fact key.' },
  value: { type: 'json', required: true, description: 'The value to remember (any JSON value).' },
}

export const outputSchema = { type: 'object', properties: { ok: { type: 'boolean', required: true }, error: { type: 'string' } }, additionalProperties: false }

/** @param {{ key: string, value: unknown }} args */
export function remember(args) {
  const store = readStore()
  store[args.key] = args.value
  try {
    writeStore(store)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
