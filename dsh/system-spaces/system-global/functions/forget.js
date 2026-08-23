import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const memoryPath = () => join(process.env['LMTHING_SPACE_DIR'] ?? '.', '.lmthing', 'memory.json')

export const description = 'Delete a remembered fact by key.'

export const schema = {
  key: { type: 'string', required: true, description: 'The fact key.' },
}

export const outputSchema = { type: 'object', properties: { ok: { type: 'boolean', required: true }, error: { type: 'string' } }, additionalProperties: false }

/** @param {{ key: string }} args */
export function forget(args) {
  let store = {}
  try {
    store = JSON.parse(readFileSync(memoryPath(), 'utf8'))
  } catch {
    store = {}
  }
  delete store[args.key]
  const path = memoryPath()
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(store, null, 2), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
