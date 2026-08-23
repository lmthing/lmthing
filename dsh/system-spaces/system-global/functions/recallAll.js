import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const memoryPath = () => join(process.env['LMTHING_SPACE_DIR'] ?? '.', '.lmthing', 'memory.json')

export const description = 'Return all remembered facts as a key to value object.'

export const schema = {}

export const outputSchema = {
  type: 'object',
  properties: { ok: { type: 'boolean', required: true }, facts: { type: 'json', required: true } },
  additionalProperties: false,
}

export function recallAll() {
  try {
    return { ok: true, facts: JSON.parse(readFileSync(memoryPath(), 'utf8')) }
  } catch {
    return { ok: true, facts: {} }
  }
}
