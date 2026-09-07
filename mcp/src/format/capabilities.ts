import { CAPABILITY_IDS, type Capability } from './types.ts';

const KNOWN_CAPABILITY_IDS = new Set<string>(CAPABILITY_IDS);

const BARE_ONLY = new Set([
  'views:write', 'api:write', 'hooks:write', 'self:author', 'project:manage', 'store:read', 'store:install',
  'events:emit', 'fs:scratch', 'fs:local:read', 'fs:local:write', 'browser:cdp', 'team:read', 'team:post',
]);
const DB_IDS = new Set(['db:read', 'db:write', 'db:schema']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function stringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === 'string');
}

/**
 * Validate one capability's config against its own allowed-key set, matching the depth of
 * `sdk/org/libs/core/src/spaces/capabilities.ts` / `@lmthing/dsh-space-format`'s `parseCapabilities`
 * — reimplemented natively here (this package stays a standalone, zero-@lmthing/*-dependency MCP
 * server; see package.json) rather than imported, so a config with an unknown key, a non-array
 * list, or (for `api:call`/`connections:use`) an empty list no longer silently validates. This
 * closes a real fidelity gap: the prior version only checked "config must be a mapping", never the
 * shape of what's inside it.
 */
function checkConfig(id: string, config: Record<string, unknown>, path: string): void {
  if (DB_IDS.has(id)) {
    const bad = Object.keys(config).filter((k) => k !== 'tables');
    if (bad.length) throw new Error(`${path}: capability "${id}" has disallowed config key(s): ${bad.join(', ')}. Allowed key: tables`);
    if ('tables' in config && !stringArray(config.tables)) throw new Error(`${path}: capability "${id}" config "tables" must be a list of table names`);
    return;
  }
  if (id === 'api:call') {
    const bad = Object.keys(config).filter((k) => k !== 'allow');
    if (bad.length) throw new Error(`${path}: capability "api:call" has disallowed config key(s): ${bad.join(', ')}. Allowed key: allow`);
    if (!stringArray(config.allow) || config.allow.length === 0) throw new Error(`${path}: capability "api:call" requires a non-empty "allow" list of endpoint names`);
    return;
  }
  if (id === 'connections:use') {
    const bad = Object.keys(config).filter((k) => k !== 'providers');
    if (bad.length) throw new Error(`${path}: capability "connections:use" has disallowed config key(s): ${bad.join(', ')}. Allowed key: providers`);
    if (!stringArray(config.providers) || config.providers.length === 0) throw new Error(`${path}: capability "connections:use" requires a non-empty "providers" list`);
    return;
  }
  if (id === 'knowledge:write') {
    const bad = Object.keys(config).filter((k) => k !== 'spaces');
    if (bad.length) throw new Error(`${path}: capability "knowledge:write" has disallowed config key(s): ${bad.join(', ')}. Allowed key: spaces`);
    if ('spaces' in config && !stringArray(config.spaces)) throw new Error(`${path}: capability "knowledge:write" config "spaces" must be a list of space keys`);
  }
}

/** Parse and validate the standalone capability declaration format. */
export function parseCapabilities(value: unknown, path: string): Capability[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${path}: capabilities must be a list`);
  const result: Capability[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    let id: string;
    let config: unknown;
    let hasConfig = false;
    if (typeof entry === 'string') {
      id = entry;
    } else if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
      const keys = Object.keys(entry);
      if (keys.length !== 1) throw new Error(`${path}: capability mapping must have exactly one key`);
      id = keys[0] ?? '';
      config = (entry as Record<string, unknown>)[id];
      hasConfig = true;
    } else {
      throw new Error(`${path}: capability must be an id or single-key mapping`);
    }
    if (!KNOWN_CAPABILITY_IDS.has(id)) throw new Error(`${path}: declares unknown capability "${id}"`);
    if (seen.has(id)) throw new Error(`${path}: declares duplicate capability "${id}"`);
    seen.add(id);
    if (hasConfig && BARE_ONLY.has(id)) throw new Error(`${path}: capability "${id}" takes no config (bare only)`);
    if ((id === 'api:call' || id === 'connections:use') && !hasConfig) {
      throw new Error(`${path}: capability "${id}" requires config`);
    }
    if (hasConfig && (config === null || typeof config !== 'object' || Array.isArray(config))) {
      throw new Error(`${path}: capability "${id}" config must be a mapping`);
    }
    if (hasConfig && isRecord(config)) checkConfig(id, config, path);
    result.push(hasConfig ? { id, config } : { id });
  }
  return result;
}
