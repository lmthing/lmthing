/**
 * Shared types for the unified LMThing space-format parser.
 *
 * This package is the SINGLE canonical implementation of "parse an on-disk LMThing space into a
 * typed structure" — unifying what were three independent implementations
 * (`sdk/org/libs/core/src/spaces/`, `mcp/src/format/`, and this package's own earlier JS port).
 * See `dsh/PROGRESS.md` (Part A1) for the full comparison and the design decisions this merge
 * makes. Every consumer (`@lmthing/dsh-space-*` plugins, and `mcp/src/format` as a thin adapter)
 * imports from here rather than re-deriving this parsing logic.
 */

export interface Space {
  dir: string;
  /** npm package name from the space's own `package.json`, when present. */
  packageName?: string;
  agents: Record<string, AgentDef>;
  /** slug -> sorted node files (directory-scan level; per-node parsing is a separate concern,
   *  owned by `@lmthing/dsh-space-tasklist`'s richer `TaskNode` loader). */
  tasklists: Record<string, TasklistDir>;
  /** name -> original source (`.ts`/`.tsx`/`.js`/`.mjs` — the `.js`/`.mjs` recognition is a
   *  deliberate widening for this port: LMThing's original QuickJS-sandbox runtime only accepts
   *  `.ts`/`.tsx`; this port's functions run as real Node ESM, dynamically imported. */
  functions: Record<string, string>;
  components: {
    /** name -> source (`components/view/<Name>.{tsx,ts}`). */
    view: Record<string, string>;
    /** name -> source (`components/form/<Name>.{tsx,ts}`, or the legacy `<Name>/{web,ink}.tsx`
     *  split, read defensively so a not-yet-migrated space keeps loading). */
    form: Record<string, string>;
  };
  knowledge: KnowledgeTree;
}

export interface AgentDef {
  slug: string;
  title: string;
  /** Body of `instruct.md` (frontmatter stripped). */
  instructBody: string;
  /** Body of `charter.md` — short, fork-safe identity/guardrails. Empty when absent. */
  charterBody: string;
  actions: ActionDef[];
  /**
   * Other agents this agent can delegate to. Tri-state — the loader preserves the distinction,
   * do NOT normalize:
   *   - `undefined` (key omitted) -> unrestricted delegation (back-compat)
   *   - `[]`                      -> NO delegation
   *   - `["*"]`                   -> explicitly unrestricted
   *   - explicit list             -> hard allowlist, enforced downstream
   */
  canDelegateTo?: string[];
  /** Optional model alias/spec (frontmatter `model:`). Undefined = inherit the caller's model. */
  model?: string;
  config: AgentConfig;
  /** When set, a freeform session for this agent runs this action's tasklist deterministically
   *  instead of the model-driven turn loop. */
  defaultAction?: string;
  /** Parsed capability grants from the `capabilities:` frontmatter key. Always populated (empty
   *  object when the key is absent) once loaded through `loadAgent`. */
  capabilities?: AppCapabilities;
  /** Inbound-webhook bindings declared via `triggers:`. Undefined when the key is absent. */
  triggers?: WebhookTrigger[];
}

export interface ActionDef {
  id: string;
  label: string;
  description: string;
  tasklist: string;
}

/** An inbound-webhook binding declared in an agent's `triggers:` frontmatter. */
export interface WebhookTrigger {
  path: string;
  provider?: string;
}

export interface AgentConfig {
  knowledge: string[];
  functions: string[];
  components: string[];
}

export interface TasklistDir {
  slug: string;
  /** Sorted absolute paths to the tasklist's node files (`NN-<id>.md`/`NN-<id>.ts`, interleaved
   *  by NN prefix; `index.md` excluded). */
  files: string[];
  /** Body of `tasklists/<name>/index.md`, when present. */
  description?: string;
  /** Input schema declared in `index.md` frontmatter (field name -> type string). */
  input?: Record<string, string>;
  /** Tasklist-level connection gate (`connections: [<provider>, …]`). Typed data only —
   *  enforcement is a downstream concern. */
  connections?: string[];
}

export interface KnowledgeTree {
  domains: Record<string, KnowledgeDomain>;
}

export interface KnowledgeDomain {
  slug: string;
  fields: Record<string, KnowledgeField>;
  /** Body of `knowledge/<domain>/index.md`, when present. */
  description?: string;
}

export interface KnowledgeField {
  slug: string;
  type: string;
  variableName: string;
  default?: unknown;
  /** option slug -> that option file's absolute path. */
  options: Record<string, string>;
  /** option slug -> that option file's `description:` frontmatter, when it has one. Knowledge is
   *  lazy: the system prompt lists an option's name and the agent decides whether to load it — the
   *  description is the "when", collected for free since the option file is already read here to
   *  validate its frontmatter. */
  optionDescriptions: Record<string, string>;
  /** option slug -> that option file's `label:` frontmatter, when it has one. Additive relative to
   *  the original core/dsh shape (this port's own extension, folding in mcp's `label` surfacing
   *  without breaking the existing parallel-Record shape every consumer already reads). */
  optionTitles: Record<string, string>;
  /** Body of `knowledge/<domain>/<field>/index.md` — the field's overview. */
  description?: string;
}

// ---------------------------------------------------------------- capabilities

export type CapabilityId =
  | 'db:read'
  | 'db:write'
  | 'db:schema'
  | 'views:write'
  | 'api:write'
  | 'hooks:write'
  | 'api:call'
  | 'connections:use'
  | 'knowledge:write'
  | 'self:author'
  | 'project:manage'
  | 'store:read'
  | 'store:install'
  | 'events:emit'
  | 'fs:scratch'
  | 'fs:local:read'
  | 'fs:local:write'
  | 'browser:cdp'
  | 'team:read'
  | 'team:post';

export interface AppCapabilities {
  'db:read'?: { tables?: string[] };
  'db:write'?: { tables?: string[] };
  'db:schema'?: { tables?: string[] };
  'views:write'?: true;
  'api:write'?: true;
  'hooks:write'?: true;
  'api:call'?: { allow: string[] };
  'connections:use'?: { providers: string[] };
  'knowledge:write'?: { spaces?: string[] };
  'self:author'?: true;
  'project:manage'?: true;
  'store:read'?: true;
  'store:install'?: true;
  'events:emit'?: true;
  'fs:scratch'?: true;
  'fs:local:read'?: true;
  'fs:local:write'?: true;
  'browser:cdp'?: true;
  'team:read'?: true;
  'team:post'?: true;
}

export interface ParseCapabilitiesCtx {
  /** Agent slug, for actionable error messages. */
  agentId: string;
  /** Table names known to the resolving project's `database/`. When provided, a `db:*` cap naming
   *  an unknown table fails loud. Undefined (a system/project-agnostic space) defers the check. */
  knownTables?: string[];
}

// ---------------------------------------------------------------- loader options

export interface LoadSpaceOpts {
  /** When false, a space without an `agents/` directory is allowed (function-only system spaces).
   *  Defaults to true. */
  requireAgents?: boolean;
  /** Warn channel for non-fatal load diagnostics (e.g. `canDelegateTo: []` + a `delegate(` call in
   *  prose). Defaults to `console.warn` with a `[space-format]` prefix. */
  onWarn?: (message: string) => void;
  /** Table names in the resolving project's `database/` — see `ParseCapabilitiesCtx.knownTables`. */
  knownTables?: string[];
}

// ---------------------------------------------------------------- DAG utilities

/** The minimal shape `validateDag`/`readyNodes`/`topoOrder` need. Deliberately NOT importing the
 *  richer `TaskNode` type from `@lmthing/dsh-space-tasklist` (which depends on THIS package for
 *  its own function/capability-id references — importing back would be circular). Any node map
 *  with `id`+`dependsOn` — including `@lmthing/dsh-space-tasklist`'s rich `TaskNode` — satisfies
 *  this shape structurally. */
export interface DagNode {
  id: string;
  dependsOn?: string[];
  /** Optional, for attributing a problem to a source file. */
  file?: string;
}

export interface DagProblem {
  /** Source file the problem traces to, or '' when it's whole-graph (e.g. an unknown target named
   *  by several nodes, or a cycle with no single owning file). */
  file: string;
  message: string;
}
