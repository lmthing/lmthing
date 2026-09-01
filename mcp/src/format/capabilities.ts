import { CAPABILITY_IDS, type Capability } from './types.ts';

const KNOWN_CAPABILITY_IDS = new Set<string>(CAPABILITY_IDS);

const BARE_ONLY = new Set(['views:write', 'api:write', 'hooks:write', 'self:author', 'project:manage', 'store:read', 'store:install', 'events:emit']);

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
    result.push(hasConfig ? { id, config } : { id });
  }
  return result;
}
