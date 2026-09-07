/**
 * App-capability parsing for agent `instruct.md` frontmatter (`capabilities:`).
 *
 * Ported from `sdk/org/libs/core/src/spaces/capabilities.ts` (validation logic and depth kept in
 * full — Part A1 design decision #2: this is the winning implementation, not `mcp/src/format`'s,
 * which lacks unknown-config-key/array-element-type/non-empty-list/table-existence checks). Fixes
 * a real, confirmed bug in the prior `dsh/packages/space-format/src/capabilities.js` port: it was
 * missing `self:author` from both `CAPABILITY_IDS` and `BARE_ONLY_CAPABILITY_IDS` — a real,
 * documented capability (`org/docs/format/space/agents/capabilities.md`) that the actual
 * production `user-thing` space declares, causing a live test failure (see `dsh/PROGRESS.md`).
 *
 * A `capabilities:` value is a YAML list whose entries are either a bare capability id (full
 * scope) or a single-key map carrying that capability's config (narrowed scope):
 *
 * ```yaml
 * capabilities:
 *   - db:read: { tables: [sources, raw_items] }
 *   - db:write: { tables: [raw_items] }
 *   - api:call: { allow: [webSearch, markRead] }
 *   - connections:use: { providers: [google, slack] }
 *   - views:write
 * ```
 *
 * This unified package does not bridge most of these onto dsh — only `functions`/`knowledge` refs
 * feed the `@lmthing/dsh-space-*` plugins today (the data/project-app half — db/views/api/
 * connections/events/hooks — is explicitly out of scope for this migration). Parsing/validation is
 * kept in full anyway so `loadAgent` stays a faithful, fail-loud parser of what's actually on disk,
 * regardless of which capabilities a given consumer chooses to act on.
 */

import type { AppCapabilities, CapabilityId, ParseCapabilitiesCtx } from './types.ts';

/** Every recognized capability id. Unknown ids fail the space load. */
export const CAPABILITY_IDS: ReadonlySet<CapabilityId> = new Set<CapabilityId>([
  'db:read',
  'db:write',
  'db:schema',
  'views:write',
  'api:write',
  'hooks:write',
  'api:call',
  'connections:use',
  'knowledge:write',
  'self:author',
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
]);

/** Team-pod-only capability ids — dropped (never rejected) on a non-team pod. */
export const TEAM_CAPABILITY_IDS: ReadonlySet<CapabilityId> = new Set<CapabilityId>(['team:read', 'team:post']);

/**
 * Grants a team pod must never hold, whatever an agent declares — the mirror image of
 * `TEAM_CAPABILITY_IDS`. Dropped (never rejected) on a team pod.
 */
export const DESKTOP_ONLY_CAPABILITY_IDS: ReadonlySet<CapabilityId> = new Set<CapabilityId>([
  'fs:local:read',
  'fs:local:write',
  'browser:cdp',
]);

/** The three db verbs whose (optional) config narrows scope to `{ tables: [...] }`. */
export const DB_CAPABILITY_IDS: ReadonlySet<CapabilityId> = new Set<CapabilityId>(['db:read', 'db:write', 'db:schema']);

/** Authoring/store/event caps that are bare-only — a config payload is an error. */
const BARE_ONLY_CAPABILITY_IDS: ReadonlySet<CapabilityId> = new Set<CapabilityId>([
  'views:write',
  'api:write',
  'hooks:write',
  'self:author',
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
]);

/**
 * True when this process is a team pod. LMThing reads a gateway-set env var; this deployment has
 * no such concept yet, so this is always false today — kept as a function (not inlined `false`) so
 * a later phase can wire a real signal without touching call sites.
 */
export function isTeamPod(): boolean {
  return process.env['LMTHING_TEAM_MODE'] === '1';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseKnowledgeWriteConfig(config: unknown, ctx: ParseCapabilitiesCtx): { spaces?: string[] } {
  if (!isRecord(config)) {
    throw new Error(
      `Agent "${ctx.agentId}" capability "knowledge:write" has an invalid config: expected a map like { spaces: [...] }`,
    );
  }
  const unknownKeys = Object.keys(config).filter((k) => k !== 'spaces');
  if (unknownKeys.length > 0) {
    throw new Error(
      `Agent "${ctx.agentId}" capability "knowledge:write" has disallowed config key(s): ${unknownKeys.join(', ')}. Allowed key: spaces`,
    );
  }
  if (!('spaces' in config)) return {};
  const rawSpaces = config['spaces'];
  if (!Array.isArray(rawSpaces) || rawSpaces.some((s) => typeof s !== 'string')) {
    throw new Error(`Agent "${ctx.agentId}" capability "knowledge:write" config "spaces" must be a list of space keys`);
  }
  return { spaces: rawSpaces as string[] };
}

function parseDbConfig(id: CapabilityId, config: unknown, ctx: ParseCapabilitiesCtx): { tables?: string[] } {
  if (!isRecord(config)) {
    throw new Error(`Agent "${ctx.agentId}" capability "${id}" has an invalid config: expected a map like { tables: [...] }`);
  }
  const unknownKeys = Object.keys(config).filter((k) => k !== 'tables');
  if (unknownKeys.length > 0) {
    throw new Error(`Agent "${ctx.agentId}" capability "${id}" has disallowed config key(s): ${unknownKeys.join(', ')}. Allowed key: tables`);
  }
  if (!('tables' in config)) return {};

  const rawTables = config['tables'];
  if (!Array.isArray(rawTables) || rawTables.some((t) => typeof t !== 'string')) {
    throw new Error(`Agent "${ctx.agentId}" capability "${id}" config "tables" must be a list of table names`);
  }
  const tables = rawTables as string[];

  if (ctx.knownTables !== undefined) {
    const known = new Set(ctx.knownTables);
    const missing = tables.filter((t) => !known.has(t));
    if (missing.length > 0) {
      throw new Error(
        `Agent "${ctx.agentId}" capability "${id}" names table(s) not in the project's database/: ${missing.join(', ')}. Known tables: ${ctx.knownTables.length ? ctx.knownTables.join(', ') : '(none)'}`,
      );
    }
  }

  return { tables };
}

function parseApiCallConfig(config: unknown, ctx: ParseCapabilitiesCtx): { allow: string[] } {
  if (!isRecord(config)) {
    throw new Error(`Agent "${ctx.agentId}" capability "api:call" has an invalid config: expected a map like { allow: [...] }`);
  }
  const unknownKeys = Object.keys(config).filter((k) => k !== 'allow');
  if (unknownKeys.length > 0) {
    throw new Error(`Agent "${ctx.agentId}" capability "api:call" has disallowed config key(s): ${unknownKeys.join(', ')}. Allowed key: allow`);
  }
  const rawAllow = config['allow'];
  if (!Array.isArray(rawAllow) || rawAllow.length === 0 || rawAllow.some((a) => typeof a !== 'string')) {
    throw new Error(
      `Agent "${ctx.agentId}" capability "api:call" requires a non-empty "allow" list of endpoint names, or ["*"] for any endpoint the project declares`,
    );
  }
  return { allow: rawAllow as string[] };
}

function parseConnectionsConfig(config: unknown, ctx: ParseCapabilitiesCtx): { providers: string[] } {
  if (!isRecord(config)) {
    throw new Error(`Agent "${ctx.agentId}" capability "connections:use" has an invalid config: expected a map like { providers: [...] }`);
  }
  const unknownKeys = Object.keys(config).filter((k) => k !== 'providers');
  if (unknownKeys.length > 0) {
    throw new Error(`Agent "${ctx.agentId}" capability "connections:use" has disallowed config key(s): ${unknownKeys.join(', ')}. Allowed key: providers`);
  }
  const rawProviders = config['providers'];
  if (!Array.isArray(rawProviders) || rawProviders.length === 0 || rawProviders.some((p) => typeof p !== 'string')) {
    throw new Error(
      `Agent "${ctx.agentId}" capability "connections:use" requires a non-empty "providers" list of service ids (there is no "connect to anything")`,
    );
  }
  return { providers: rawProviders as string[] };
}

/**
 * Parse the frontmatter `capabilities:` list into an {@link AppCapabilities} model. `raw` is the
 * raw frontmatter value (expected: a list); `undefined`/absent yields an empty model. Throws
 * (fail-loud) on any malformed entry.
 */
export function parseCapabilities(raw: unknown, ctx: ParseCapabilitiesCtx): AppCapabilities {
  const result: AppCapabilities = {};
  if (raw === undefined || raw === null) return result;

  if (!Array.isArray(raw)) {
    throw new Error(`Agent "${ctx.agentId}" "capabilities" must be a list of capability ids (bare) or single-key maps (id: { config })`);
  }

  for (const entry of raw) {
    let id: string;
    let config: unknown;

    if (typeof entry === 'string') {
      id = entry;
    } else if (isRecord(entry)) {
      const keys = Object.keys(entry);
      if (keys.length !== 1) {
        throw new Error(`Agent "${ctx.agentId}" capability entry must be a single-key map (id: { config }); got keys: ${keys.join(', ') || '(none)'}`);
      }
      id = keys[0]!;
      config = entry[id];
    } else {
      throw new Error(`Agent "${ctx.agentId}" has an invalid capabilities entry: expected a string id or a single-key map, got ${typeof entry}`);
    }

    if (!CAPABILITY_IDS.has(id as CapabilityId)) {
      throw new Error(`Agent "${ctx.agentId}" declares unknown capability "${id}". Known capabilities: ${[...CAPABILITY_IDS].join(', ')}`);
    }
    const capId = id as CapabilityId;

    if (result[capId] !== undefined) {
      throw new Error(`Agent "${ctx.agentId}" declares capability "${capId}" more than once`);
    }

    if (BARE_ONLY_CAPABILITY_IDS.has(capId)) {
      if (config !== undefined) {
        throw new Error(`Agent "${ctx.agentId}" capability "${capId}" takes no config (bare only) — remove the "{ ... }"`);
      }
      (result as Record<string, unknown>)[capId] = true;
      continue;
    }

    if (DB_CAPABILITY_IDS.has(capId)) {
      (result as Record<string, unknown>)[capId] = config === undefined ? {} : parseDbConfig(capId, config, ctx);
      continue;
    }

    if (capId === 'knowledge:write') {
      result['knowledge:write'] = config === undefined ? {} : parseKnowledgeWriteConfig(config, ctx);
      continue;
    }

    if (capId === 'connections:use') {
      if (config === undefined) {
        throw new Error(`Agent "${ctx.agentId}" capability "connections:use" requires a config with a "providers" list, e.g. connections:use: { providers: [google] }`);
      }
      result['connections:use'] = parseConnectionsConfig(config, ctx);
      continue;
    }

    if (config === undefined) {
      throw new Error(`Agent "${ctx.agentId}" capability "api:call" requires a config with an "allow" list, e.g. api:call: { allow: [markRead] }`);
    }
    result['api:call'] = parseApiCallConfig(config, ctx);
  }

  if (!isTeamPod()) {
    for (const id of TEAM_CAPABILITY_IDS) delete result[id];
  } else {
    for (const id of DESKTOP_ONLY_CAPABILITY_IDS) delete result[id];
  }

  return result;
}
