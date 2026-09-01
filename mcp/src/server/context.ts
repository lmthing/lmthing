import { loadSpaces } from '../format/load.ts';
import { createExtractor } from '../schema/derive.ts';
import type { Agent, LoadSpaces, Space } from '../format/types.ts';
import type { ServerCtx } from '../tools/ctx.ts';

export interface ServerContextOptions {
  spacesDir: string;
  loader?: LoadSpaces;
  /** Rebuild dynamic tool definitions before announcing the change. */
  onActiveAgentChanged?: () => Promise<void> | void;
  /** Sends the MCP tools/list_changed notification. */
  onToolsChanged?: () => void;
}

/** The sole stateful implementation shared by every tool group. */
export class SpaceServerContext implements ServerCtx {
  readonly spacesDir: string;
  private readonly loader: LoadSpaces;
  private readonly onActiveAgentChanged: () => Promise<void> | void;
  private readonly onToolsChanged: () => void;
  private cachedSpaces: Space[] | undefined;
  private active: Agent | null = null;
  private activeOwner: Space | null = null;

  constructor(options: ServerContextOptions) {
    this.spacesDir = options.spacesDir;
    this.loader = options.loader ?? loadSpaces;
    this.onActiveAgentChanged = options.onActiveAgentChanged ?? (() => undefined);
    this.onToolsChanged = options.onToolsChanged ?? (() => undefined);
  }

  /**
   * The ONLY place spaces are loaded.
   *
   * There were two call sites and only one passed the extractor, so every schema in the
   * server collapsed to the empty fallback the first time anything was authored (any write
   * calls `reload()`) — permanently, and with no error. Two forwarding sites where one
   * forgets an argument is a failure this codebase has now produced twice; the fix is to
   * leave exactly one.
   */
  private load(): Promise<Space[]> {
    return this.loader(this.spacesDir, { extractorFor: createExtractor });
  }

  async spaces(): Promise<Space[]> {
    this.cachedSpaces ??= await this.load();
    return this.cachedSpaces;
  }

  async reload(): Promise<void> {
    this.cachedSpaces = await this.load();
    if (this.active && !this.cachedSpaces.some((space) => space.agents.some((agent) => agent.ref === this.active?.ref))) {
      this.active = null;
      this.activeOwner = null;
    } else if (this.active) {
      const resolved = await this.findAgent(this.active.ref);
      this.active = resolved?.agent ?? null;
      this.activeOwner = resolved?.space ?? null;
    }
    await this.onActiveAgentChanged();
    this.notifyToolsChanged();
  }

  activeAgent(): Agent | null { return this.active; }
  activeSpace(): Space | null { return this.activeOwner; }

  async setActiveAgent(ref: string): Promise<void> {
    const resolved = await this.findAgent(ref);
    if (!resolved) throw new Error(`Unknown agent reference: ${ref}`);
    this.active = resolved.agent;
    this.activeOwner = resolved.space;
    await this.onActiveAgentChanged();
    this.notifyToolsChanged();
  }

  notifyToolsChanged(): void { this.onToolsChanged(); }

  async space(id: string): Promise<Space | undefined> {
    return (await this.spaces()).find((space) => space.id === id);
  }

  async agent(ref: string): Promise<Agent | undefined> {
    return (await this.findAgent(ref))?.agent;
  }

  private async findAgent(ref: string): Promise<{ space: Space; agent: Agent } | undefined> {
    for (const space of await this.spaces()) {
      const agent = space.agents.find((candidate) => candidate.ref === ref);
      if (agent) return { space, agent };
    }
    return undefined;
  }
}
