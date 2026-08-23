/**
 * App-capability parsing for agent `instruct.md` frontmatter (`capabilities:`).
 *
 * Ported verbatim (types dropped, runtime logic unchanged) from
 * sdk/org/libs/core/src/spaces/capabilities.ts. Phase 1 (see the plan) does
 * NOT bridge most of these onto dsh — only `functions`/`knowledge` refs feed
 * the space-functions/space-knowledge plugins today. Parsing/validation is kept in full so `loadAgent` stays
 * faithful to the original fail-loud contract, and so later phases (the
 * project-authoring capability model, listed in the plan's roadmap) don't
 * need to re-derive this from scratch.
 *
 * A `capabilities:` value is a YAML list whose entries are either a bare
 * capability id (full scope) or a single-key map carrying that capability's
 * config (narrowed scope):
 *
 *   capabilities:
 *     - db:read: { tables: [sources, raw_items] }
 *     - db:write: { tables: [raw_items] }
 *     - api:call: { allow: [webSearch, markRead] }
 *     - connections:use: { providers: [google, slack] }
 *     - views:write
 */

/** Every recognized capability id. Unknown ids fail the space load. */
export const CAPABILITY_IDS = new Set([
  'db:read',
  'db:write',
  'db:schema',
  'views:write',
  'api:write',
  'hooks:write',
  'api:call',
  'connections:use',
  'knowledge:write',
  'project:manage',
  'store:read',
  'store:install',
  'events:emit',
  'fs:scratch',
  'fs:local:read',
  'fs:local:write',
  'browser:cdp',
  'team:read',
  'team:post',
])

/** Team-pod-only capability ids — dropped (never rejected) on a non-team pod. */
export const TEAM_CAPABILITY_IDS = new Set(['team:read', 'team:post'])

/** Desktop-only capability ids — dropped (never rejected) on a team pod. */
export const DESKTOP_ONLY_CAPABILITY_IDS = new Set(['fs:local:read', 'fs:local:write', 'browser:cdp'])

/** The three db verbs whose (optional) config narrows scope to `{ tables: [...] }`. */
export const DB_CAPABILITY_IDS = new Set(['db:read', 'db:write', 'db:schema'])

/** Authoring/store/event caps that are bare-only — a config payload is an error. */
const BARE_ONLY_CAPABILITY_IDS = new Set([
  'views:write',
  'api:write',
  'hooks:write',
  'project:manage',
  'store:read',
  'store:install',
  'events:emit',
  'fs:scratch',
  'fs:local:read',
  'fs:local:write',
  'browser:cdp',
  'team:read',
  'team:post',
])

/**
 * True when this process is a team pod. LMThing reads a gateway-set env var;
 * we have no such deployment concept yet, so this is always false today —
 * kept as a function (not inlined `false`) so a later phase can wire a real
 * signal without touching call sites.
 * @returns {boolean}
 */
export function isTeamPod() {
  return process.env['LMTHING_TEAM_MODE'] === '1'
}

function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function parseKnowledgeWriteConfig(config, ctx) {
  if (!isRecord(config)) {
    throw new Error(`Agent "${ctx.agentId}" capability "knowledge:write" has an invalid config: expected a map like { spaces: [...] }`)
  }
  const unknownKeys = Object.keys(config).filter((k) => k !== 'spaces')
  if (unknownKeys.length > 0) {
    throw new Error(`Agent "${ctx.agentId}" capability "knowledge:write" has disallowed config key(s): ${unknownKeys.join(', ')}. Allowed key: spaces`)
  }
  if (!('spaces' in config)) return {}
  const rawSpaces = config['spaces']
  if (!Array.isArray(rawSpaces) || rawSpaces.some((s) => typeof s !== 'string')) {
    throw new Error(`Agent "${ctx.agentId}" capability "knowledge:write" config "spaces" must be a list of space keys`)
  }
  return { spaces: rawSpaces }
}

function parseDbConfig(id, config, ctx) {
  if (!isRecord(config)) {
    throw new Error(`Agent "${ctx.agentId}" capability "${id}" has an invalid config: expected a map like { tables: [...] }`)
  }
  const unknownKeys = Object.keys(config).filter((k) => k !== 'tables')
  if (unknownKeys.length > 0) {
    throw new Error(`Agent "${ctx.agentId}" capability "${id}" has disallowed config key(s): ${unknownKeys.join(', ')}. Allowed key: tables`)
  }
  if (!('tables' in config)) return {}

  const rawTables = config['tables']
  if (!Array.isArray(rawTables) || rawTables.some((t) => typeof t !== 'string')) {
    throw new Error(`Agent "${ctx.agentId}" capability "${id}" config "tables" must be a list of table names`)
  }
  const tables = rawTables

  if (ctx.knownTables !== undefined) {
    const known = new Set(ctx.knownTables)
    const missing = tables.filter((t) => !known.has(t))
    if (missing.length > 0) {
      throw new Error(
        `Agent "${ctx.agentId}" capability "${id}" names table(s) not in the project's database/: ${missing.join(', ')}. Known tables: ${ctx.knownTables.length ? ctx.knownTables.join(', ') : '(none)'}`,
      )
    }
  }

  return { tables }
}

function parseApiCallConfig(config, ctx) {
  if (!isRecord(config)) {
    throw new Error(`Agent "${ctx.agentId}" capability "api:call" has an invalid config: expected a map like { allow: [...] }`)
  }
  const unknownKeys = Object.keys(config).filter((k) => k !== 'allow')
  if (unknownKeys.length > 0) {
    throw new Error(`Agent "${ctx.agentId}" capability "api:call" has disallowed config key(s): ${unknownKeys.join(', ')}. Allowed key: allow`)
  }
  const rawAllow = config['allow']
  if (!Array.isArray(rawAllow) || rawAllow.length === 0 || rawAllow.some((a) => typeof a !== 'string')) {
    throw new Error(
      `Agent "${ctx.agentId}" capability "api:call" requires a non-empty "allow" list of endpoint names, or ["*"] for any endpoint the project declares`,
    )
  }
  return { allow: rawAllow }
}

function parseConnectionsConfig(config, ctx) {
  if (!isRecord(config)) {
    throw new Error(`Agent "${ctx.agentId}" capability "connections:use" has an invalid config: expected a map like { providers: [...] }`)
  }
  const unknownKeys = Object.keys(config).filter((k) => k !== 'providers')
  if (unknownKeys.length > 0) {
    throw new Error(`Agent "${ctx.agentId}" capability "connections:use" has disallowed config key(s): ${unknownKeys.join(', ')}. Allowed key: providers`)
  }
  const rawProviders = config['providers']
  if (!Array.isArray(rawProviders) || rawProviders.length === 0 || rawProviders.some((p) => typeof p !== 'string')) {
    throw new Error(`Agent "${ctx.agentId}" capability "connections:use" requires a non-empty "providers" list of service ids (there is no "connect to anything")`)
  }
  return { providers: rawProviders }
}

/**
 * Parse the frontmatter `capabilities:` list into an app-capabilities model.
 * `raw` is the raw frontmatter value (expected: a list); `undefined`/absent
 * yields an empty model. Throws (fail-loud) on any malformed entry.
 *
 * @param {unknown} raw
 * @param {{ agentId: string, knownTables?: string[] }} ctx
 * @returns {Record<string, unknown>}
 */
export function parseCapabilities(raw, ctx) {
  const result = {}
  if (raw === undefined || raw === null) return result

  if (!Array.isArray(raw)) {
    throw new Error(`Agent "${ctx.agentId}" "capabilities" must be a list of capability ids (bare) or single-key maps (id: { config })`)
  }

  for (const entry of raw) {
    let id
    let config // undefined = bare entry

    if (typeof entry === 'string') {
      id = entry
    } else if (isRecord(entry)) {
      const keys = Object.keys(entry)
      if (keys.length !== 1) {
        throw new Error(`Agent "${ctx.agentId}" capability entry must be a single-key map (id: { config }); got keys: ${keys.join(', ') || '(none)'}`)
      }
      id = keys[0]
      config = entry[id]
    } else {
      throw new Error(`Agent "${ctx.agentId}" has an invalid capabilities entry: expected a string id or a single-key map, got ${typeof entry}`)
    }

    if (!CAPABILITY_IDS.has(id)) {
      throw new Error(`Agent "${ctx.agentId}" declares unknown capability "${id}". Known capabilities: ${[...CAPABILITY_IDS].join(', ')}`)
    }

    if (result[id] !== undefined) {
      throw new Error(`Agent "${ctx.agentId}" declares capability "${id}" more than once`)
    }

    if (BARE_ONLY_CAPABILITY_IDS.has(id)) {
      if (config !== undefined) {
        throw new Error(`Agent "${ctx.agentId}" capability "${id}" takes no config (bare only) — remove the "{ ... }"`)
      }
      result[id] = true
      continue
    }

    if (DB_CAPABILITY_IDS.has(id)) {
      result[id] = config === undefined ? {} : parseDbConfig(id, config, ctx)
      continue
    }

    if (id === 'knowledge:write') {
      result['knowledge:write'] = config === undefined ? {} : parseKnowledgeWriteConfig(config, ctx)
      continue
    }

    if (id === 'connections:use') {
      if (config === undefined) {
        throw new Error(`Agent "${ctx.agentId}" capability "connections:use" requires a config with a "providers" list, e.g. connections:use: { providers: [google] }`)
      }
      result['connections:use'] = parseConnectionsConfig(config, ctx)
      continue
    }

    // Only api:call remains, and its allow list is required.
    if (config === undefined) {
      throw new Error(`Agent "${ctx.agentId}" capability "api:call" requires a config with an "allow" list, e.g. api:call: { allow: [markRead] }`)
    }
    result['api:call'] = parseApiCallConfig(config, ctx)
  }

  if (!isTeamPod()) {
    for (const id of TEAM_CAPABILITY_IDS) delete result[id]
  } else {
    for (const id of DESKTOP_ONLY_CAPABILITY_IDS) delete result[id]
  }

  return result
}
