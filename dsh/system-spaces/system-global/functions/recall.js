import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const memoryPath = () => join(process.env['LMTHING_SPACE_DIR'] ?? '.', '.lmthing', 'memory.json')

export const description = 'Recall a previously remembered fact by key. found=false if it was never stored.'

export const schema = {
  key: { type: 'string', required: true, description: 'The fact key.' },
}

export const outputSchema = {
  type: 'object',
  properties: { ok: { type: 'boolean', required: true }, value: { type: 'json' }, found: { type: 'boolean', required: true } },
  additionalProperties: false,
}

/** @param {{ key: string }} args */
export function recall(args) {
  try {
    const store = JSON.parse(readFileSync(memoryPath(), 'utf8'))
    // dsh's lossless-JSON tool-output snapshotting rejects `undefined`
    // outright (see docs/architecture.md's Code Mode section) — found the
    // hard way when a missing key produced `value: undefined` and the whole
    // tool call failed with "invalid output: value is not lossless JSON".
    return { ok: true, value: store[args.key] ?? null, found: args.key in store }
  } catch {
    return { ok: true, value: null, found: false }
  }
}
