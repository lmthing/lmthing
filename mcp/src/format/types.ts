/**
 * THE SEAM.
 *
 * Every track of this package codes against this file, and it is fixed before any
 * implementation starts. Four independent tracks meet here:
 *
 *   - `format/`  parses a space directory into a `Space`          (owner: format track)
 *   - `schema/`  fills `SpaceFn.schema` / `order` / `verdict`     (owner: extraction track)
 *   - `exec/`    invokes a `SpaceFn` with arguments               (owner: extraction track)
 *   - `tools/`   projects a `Space` onto MCP tools/resources      (owner: server + authoring tracks)
 *
 * Do not widen a type here without telling the other tracks — a silent widening is how
 * four parallel implementations stop fitting together.
 */

// ---------------------------------------------------------------- JSON Schema

/** A JSON Schema fragment. Deliberately loose: this is data we hand to an MCP client. */
export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  /** MUST be present whenever `type === 'array'`. A bare array type is a bug, not a fallback. */
  items?: JsonSchema;
  enum?: (string | number | boolean | null)[];
  additionalProperties?: boolean | JsonSchema;
  [k: string]: unknown;
}

// ---------------------------------------------------------------- capabilities

/**
 * One `capabilities:` grant from an agent's frontmatter.
 *
 * A grant is either a bare id (`db:read`) or a single-key mapping carrying config
 * (`api:call: { allow: ['*'] }`), so `config` is present only for the latter form.
 */
export interface Capability {
  id: string;
  config?: unknown;
}

// ---------------------------------------------------------------- agent actions

/**
 * One `actions:` entry — a named entry point, optionally backed by a tasklist.
 * Field names are the SPEC's (`{id,label,description,tasklist}`), not invented ones.
 */
export interface Action {
  id: string;
  label?: string;
  description?: string;
  /** Must resolve to a real tasklist slug in the space, or the load fails. */
  tasklist?: string;
}

/** One `triggers:` entry — an inbound-webhook binding. */
export interface WebhookTrigger {
  path: string;
  provider?: string;
}

/**
 * The fail-loud allow-list for agent `instruct.md` frontmatter.
 *
 * Any top-level key outside this set MUST abort the whole space load. That is the
 * point: a typo'd `capabilites:` or `canDelegateto:` would otherwise silently grant
 * nothing, which is the exact failure this list exists to prevent.
 */
export const AGENT_FRONTMATTER_ALLOWED_KEYS = [
  'title', 'knowledge', 'functions', 'components', 'actions', 'defaultAction',
  'canDelegateTo', 'dependencies', 'capabilities', 'model', 'triggers',
] as const;

/** The recognized `capabilities:` grant ids. An unknown id MUST fail the load. */
export const CAPABILITY_IDS = [
  'db:read', 'db:write', 'db:schema', 'views:write', 'api:write', 'hooks:write',
  'knowledge:write', 'self:author', 'project:manage', 'api:call', 'connections:use',
  'store:read', 'store:install', 'events:emit',
] as const;

// ---------------------------------------------------------------- functions

/**
 * How faithfully a function's TypeScript signature became a JSON Schema.
 *
 * This is part of the data model rather than a log line on purpose: a wrong-but-plausible
 * schema is worse than a missing tool, because a model fills it confidently and the call
 * fails at runtime. A caller can always ask which parameter went opaque and why.
 */
export type Verdict =
  | { kind: 'exact' }
  | { kind: 'degraded'; param: string; reason: string }
  | { kind: 'explicit' };

/** A space function, resolved into everything needed to expose it as one MCP tool. */
export interface SpaceFn {
  /** Export name, which is also the file basename and the MCP tool name. */
  name: string;
  /** Absolute path to the source file. */
  file: string;
  /** From the leading JSDoc paragraph; '' when the function has no doc comment. */
  description: string;
  /** The tool's `inputSchema`. Always `type: 'object'` with one property per parameter. */
  schema: JsonSchema;
  /** Parameter names in call order — `exec/` uses this to turn named args into positional ones. */
  order: string[];
  verdict: Verdict;
}

/**
 * Injected by the extraction track and called by the loader, so the parser never
 * depends on the TypeScript compiler API and can be tested with a stub.
 */
export interface Extractor {
  extract(file: string, exportName: string): Promise<SpaceFn>;
}

// ---------------------------------------------------------------- knowledge

export interface KnowledgeOption {
  name: string;
  /** `<domain>/<field>/<option>` */
  ref: string;
  title?: string;
  description?: string;
  file: string;
}

export interface KnowledgeField {
  name: string;
  /** `<domain>/<field>` — the form an agent's `knowledge:` frontmatter uses. */
  ref: string;
  description?: string;
  options: KnowledgeOption[];
}

export interface KnowledgeDomain {
  name: string;
  description?: string;
  fields: KnowledgeField[];
}

export type KnowledgeTree = KnowledgeDomain[];

// ---------------------------------------------------------------- tasklists

/**
 * One `NN-<id>.md` step. Code nodes (`NN-*.ts`) are NOT represented: they only ran
 * against the retired orchestrator's `ctx`, and this package never executes a tasklist.
 */
export interface TaskNode {
  id: string;
  file: string;
  title?: string;
  /** The markdown body, frontmatter stripped. */
  body: string;
  dependsOn: string[];
  condition?: string;
  forEach?: string;
  /** `field -> type name`, verbatim from the step's `output:` map. */
  output?: Record<string, string>;
  role?: string;
}

export interface TasklistDag {
  slug: string;
  dir: string;
  goal?: string;
  input?: Record<string, string>;
  nodes: TaskNode[];
}

// ---------------------------------------------------------------- agents & spaces

export interface Agent {
  /** `<spaceId>/<slug>` */
  ref: string;
  slug: string;
  title: string;
  /** `charter.md` body, frontmatter stripped. '' when absent. */
  charter: string;
  /** `instruct.md` body, frontmatter stripped. This is the agent's system prompt. */
  instruct: string;
  /** Declared function names — NOT resolved; intersect with `Space.functions`. */
  functions: string[];
  /** Declared knowledge refs, each `domain/field` OR `domain/field/option` (three parts are legal). */
  knowledge: string[];
  capabilities: Capability[];
  /**
   * TRI-STATE, and the states are not interchangeable:
   *   `undefined`  the key was OMITTED  -> unrestricted at agent level
   *   `[]`         explicitly empty     -> NO delegation
   *   `['*']`      the explicit wildcard-> unrestricted
   *   `[refs...]`  an allowlist
   * Do not normalise any of these into another. Omitted vs `[]` is the difference
   * between "everything" and "nothing", and it flips silently.
   *
   * The deprecated `dependencies:` key is an alias read ONLY when `canDelegateTo`
   * is absent; resolve it during parsing so nothing downstream sees `dependencies`.
   */
  canDelegateTo: string[] | undefined;
  actions: Action[];
  /** An `actions[].id`. */
  defaultAction?: string;
  /** Model alias/spec for this agent's turns; undefined = inherit the caller. */
  model?: string;
  triggers?: WebhookTrigger[];
}

/** A part of the format this package deliberately does not support, surfaced rather than hidden. */
export interface Unsupported {
  /** Space-relative path, e.g. `components/`, `events/`, `tasklists/x/03-thing.ts`. */
  path: string;
  reason: string;
}

export interface Space {
  id: string;
  dir: string;
  agents: Agent[];
  functions: SpaceFn[];
  knowledge: KnowledgeTree;
  /** Keyed by tasklist slug. */
  tasklists: Record<string, TasklistDag>;
  /** `package.json` contents, or `null` when the space has none. */
  manifest: unknown;
  /** Present-but-ignored parts of this space. Never a silent drop. */
  unsupported: Unsupported[];
}

// ---------------------------------------------------------------- errors

export interface Problem {
  /** Space-relative path of the offending file, or '' for a whole-space problem. */
  path: string;
  message: string;
}

/**
 * Thrown on a malformed space. Carries EVERY problem found, not just the first —
 * `validate_space` reports the whole list, and a caller fixing an authoring mistake
 * should not have to round-trip once per error.
 */
export class SpaceFormatError extends Error {
  readonly problems: Problem[];
  constructor(message: string, problems: Problem[]) {
    super(message);
    this.name = 'SpaceFormatError';
    this.problems = problems;
  }
}

// ---------------------------------------------------------------- loader API

export interface LoadOpts {
  /** Omit to leave every `SpaceFn.schema` as an empty object with verdict `degraded`. */
  extractor?: Extractor;
}

export type LoadSpace = (dir: string, opts?: LoadOpts) => Promise<Space>;
export type LoadSpaces = (spacesDir: string, opts?: LoadOpts) => Promise<Space[]>;
