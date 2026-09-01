import { loadProjects } from '../format/load.ts';
import { createExtractor } from '../schema/derive.ts';
import type { Agent, LoadProjects, Project, Space } from '../format/types.ts';
import type { ServerCtx } from '../tools/ctx.ts';

export interface ServerContextOptions {
  /** The runtime root, i.e. `<cwd>/.lmthing`. Every project beneath it is served. */
  runtimeDir: string;
  /** The project new spaces are created in when a caller does not name one. */
  defaultProject?: string;
  loader?: LoadProjects;
  /** Rebuild dynamic tool definitions before announcing the change. */
  onActiveAgentChanged?: () => Promise<void> | void;
  /** Sends the MCP tools/list_changed notification. */
  onToolsChanged?: () => void;
}

/**
 * The sole stateful implementation shared by every tool group.
 *
 * ONE server serves the WHOLE runtime root: every project under `.lmthing/`, every space in
 * each, and every agent in those. A harness never restarts or repoints the server to reach a
 * different project — it just names a qualified ref.
 */
export class SpaceServerContext implements ServerCtx {
  readonly runtimeDir: string;
  readonly defaultProject: string;
  private readonly loader: LoadProjects;
  private readonly onActiveAgentChanged: () => Promise<void> | void;
  private readonly onToolsChanged: () => void;
  private cachedProjects: Project[] | undefined;
  private active: Agent | null = null;
  private activeOwner: Space | null = null;

  constructor(options: ServerContextOptions) {
    this.runtimeDir = options.runtimeDir;
    this.defaultProject = options.defaultProject ?? 'default';
    this.loader = options.loader ?? loadProjects;
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
  private load(): Promise<Project[]> {
    return this.loader(this.runtimeDir, { extractorFor: createExtractor });
  }

  async projects(): Promise<Project[]> {
    this.cachedProjects ??= await this.load();
    return this.cachedProjects;
  }

  /** Every space across every project. */
  async spaces(): Promise<Space[]> {
    return (await this.projects()).flatMap((project) => project.spaces);
  }

  async project(id: string): Promise<Project | undefined> {
    return (await this.projects()).find((candidate) => candidate.id === id);
  }

  async reload(): Promise<void> {
    this.cachedProjects = await this.load();
    if (this.active && !(await this.spaces()).some((space) => space.agents.some((agent) => agent.ref === this.active?.ref))) {
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

  /**
   * Resolve a space by `<project>/<id>`, or by a bare `<id>` when it is unambiguous.
   *
   * A bare id is accepted because it is what a caller naturally types, but it is REFUSED when
   * two projects both hold that id rather than silently picking one — a coin flip the caller
   * cannot see is worse than an error naming both candidates.
   */
  async space(ref: string): Promise<Space | undefined> {
    const all = await this.spaces();
    const qualified = all.find((space) => space.ref === ref);
    if (qualified) return qualified;
    if (ref.includes('/')) return undefined;
    const matches = all.filter((space) => space.id === ref);
    if (matches.length > 1) {
      throw new Error(`Ambiguous space id "${ref}" — qualify it as one of: ${matches.map((m) => m.ref).join(', ')}`);
    }
    return matches[0];
  }

  async agent(ref: string): Promise<Agent | undefined> {
    return (await this.findAgent(ref))?.agent;
  }

  /**
   * Resolve `<project>/<space>/<slug>`, or a bare `<space>/<slug>` when unambiguous.
   *
   * As with `space()`, a two-part ref is a convenience that REFUSES rather than guesses when
   * several projects hold the same space id.
   */
  private async findAgent(ref: string): Promise<{ space: Space; agent: Agent } | undefined> {
    const all = await this.spaces();
    for (const space of all) {
      const agent = space.agents.find((candidate) => candidate.ref === ref);
      if (agent) return { space, agent };
    }
    if (ref.split('/').length !== 2) return undefined;
    const matches: { space: Space; agent: Agent }[] = [];
    for (const space of all) {
      for (const agent of space.agents) if (`${agent.space}/${agent.slug}` === ref) matches.push({ space, agent });
    }
    if (matches.length > 1) {
      throw new Error(`Ambiguous agent ref "${ref}" — qualify it as one of: ${matches.map((m) => m.agent.ref).join(', ')}`);
    }
    return matches[0];
  }
}
