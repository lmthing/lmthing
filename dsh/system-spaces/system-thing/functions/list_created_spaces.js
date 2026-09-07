import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const userSpacesRoot = () => process.env['LMTHING_USER_SPACES_ROOT'] ?? join(process.cwd(), '.lmthing-user-spaces')

export const description =
  'List agent spaces previously created with create_agent, and which agents/knowledge topics each has.'

export const schema = {}

export const outputSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean', required: true },
    error: { type: 'string' },
    spaces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          spaceSlug: { type: 'string', required: true },
          agents: { type: 'array', items: { type: 'string' }, required: true },
          knowledgeTopics: { type: 'array', items: { type: 'string' }, required: true },
        },
        // Required, not stylistic — confirmed live: dsh's JSON-schema conversion refuses to mount
        // ANY agent preset holding a function whose nested-object schema omits this, failing with
        // "unsupported JSON schema: ...additionalProperties must be explicitly true or false" —
        // and since preset mounting is all-or-nothing, this one missing field broke every function
        // on the agent, not just this one.
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
}

function listDirNames(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

export function list_created_spaces() {
  try {
    const root = userSpacesRoot()
    const spaces = listDirNames(root).map((spaceSlug) => {
      const spaceDir = join(root, spaceSlug)
      return {
        spaceSlug,
        agents: listDirNames(join(spaceDir, 'agents')),
        knowledgeTopics: listDirNames(join(spaceDir, 'knowledge')),
      }
    })
    return { ok: true, spaces }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), spaces: [] }
  }
}
