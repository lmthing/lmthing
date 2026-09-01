/**
 * THE SECOND SEAM — the contract between the server track and every tool group.
 *
 * `server/` owns the ONE implementation of `ServerCtx` and the registry that collects
 * `tools(ctx)` from each group. A tool group NEVER loads spaces itself, never caches,
 * and never talks to the MCP SDK — it returns plain `ToolDef`s and reads state through
 * `ctx`. That is what keeps four parallel tracks from fighting over the same state.
 *
 * Do not modify this file. If you think it must change, STOP and report why.
 */
import type { Agent, JsonSchema, Space } from '../format/types.js';

export interface ToolDef {
  /** MCP tool name. Group-owned names use snake_case; a space function keeps its own name. */
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /**
   * Return any JSON-serializable value; the server wraps it for MCP.
   * Throw to produce a tool error — never call `process.exit`.
   */
  handler(args: Record<string, unknown>): Promise<unknown>;
}

export interface ServerCtx {
  /** Absolute path passed as `--spaces-dir`. */
  readonly spacesDir: string;

  /** Every space under `spacesDir`. Cached; `reload()` invalidates. */
  spaces(): Promise<Space[]>;
  /** Re-parse from disk. Any writer MUST call this after committing a change. */
  reload(): Promise<void>;

  /** `null` before any agent is selected. */
  activeAgent(): Agent | null;
  /** The space owning `activeAgent()`, or `null`. */
  activeSpace(): Space | null;
  /**
   * Select `<spaceId>/<slug>`. Throws if unknown. Recomputes the tool list and
   * emits `notifications/tools/list_changed`.
   */
  setActiveAgent(ref: string): Promise<void>;

  /** Ask the server to re-advertise its tool list. Idempotent and cheap. */
  notifyToolsChanged(): void;

  /** Resolve a space by id, or `undefined`. */
  space(id: string): Promise<Space | undefined>;
  /** Resolve an agent by `<spaceId>/<slug>`, or `undefined`. */
  agent(ref: string): Promise<Agent | undefined>;
}

/** Every tool-group module exports exactly this. */
export type ToolGroup = (ctx: ServerCtx) => ToolDef[];
