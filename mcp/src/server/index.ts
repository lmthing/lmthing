import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Agent, KnowledgeField, Space } from '../format/types.ts';
import { tools as discoveryTools } from '../tools/discovery.ts';
import { tools as functionTools } from '../tools/functions.ts';
import { tools as knowledgeTools } from '../tools/knowledge.ts';
import { tools as tasklistTools } from '../tools/tasklists.ts';
import { tools as delegationTools } from '../tools/delegation.ts';
import { tools as authoringTools } from '../tools/authoring.ts';
import type { ServerCtx, ToolDef, ToolGroup } from '../tools/ctx.ts';
import { SpaceServerContext, type ServerContextOptions } from './context.ts';

export interface McpSpaceServerOptions extends Omit<ServerContextOptions, 'onActiveAgentChanged' | 'onToolsChanged'> {
  name?: string;
  version?: string;
}

/** MCP protocol adapter and the single registry used for tools/list and tools/call. */
export class McpSpaceServer {
  readonly server: Server;
  readonly ctx: SpaceServerContext;
  private toolsByName = new Map<string, ToolDef>();

  constructor(options: McpSpaceServerOptions) {
    this.server = new Server(
      { name: options.name ?? 'mcp-space', version: options.version ?? '0.1.0' },
      { capabilities: { tools: { listChanged: true }, resources: { listChanged: true }, prompts: { listChanged: true } } },
    );
    this.ctx = new SpaceServerContext({
      ...options,
      onActiveAgentChanged: () => this.rebuildTools(),
      // `initialize()` builds the tool list BEFORE `connectStdio()`, so the first
      // notification necessarily has no transport. Swallow exactly that error rather than
      // gating on a connected flag: the send must still be ATTEMPTED, or a caller that
      // observes notifications without a transport (every unit test) sees none at all.
      onToolsChanged: () => {
        void this.server.sendToolListChanged().catch((error: unknown) => {
          if (error instanceof Error && /not connected/i.test(error.message)) return;
          logError(error);
        });
      },
    });
    this.installHandlers();
  }

  /** Load available groups and fail before serving if two groups claim a name. */
  async initialize(): Promise<void> { await this.rebuildTools(); }

  async connectStdio(): Promise<void> {
    await this.initialize();
    await this.server.connect(new StdioServerTransport());
  }

  /** Public for focused registry tests. */
  async rebuildTools(groups?: ToolGroup[]): Promise<void> {
    const loaded = groups ?? await loadToolGroups();
    const next = new Map<string, ToolDef>();
    for (const group of loaded) {
      for (const tool of group(this.ctx)) {
        if (next.has(tool.name)) throw new Error(`Duplicate MCP tool name: ${tool.name}`);
        next.set(tool.name, tool);
      }
    }
    this.toolsByName = next;
  }

  toolNames(): string[] { return [...this.toolsByName.keys()]; }

  private installHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [...this.toolsByName.values()].map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })),
    }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = this.toolsByName.get(request.params.name);
      if (!tool) return toolError(`Unknown tool: ${request.params.name}`);
      try {
        const value = await tool.handler((request.params.arguments ?? {}) as Record<string, unknown>);
        // A space function that failed must set MCP's `isError`. Reporting `ok:false`
        // inside an otherwise-successful result leaves the client's own error signal
        // saying "fine", and only a model that parses the envelope would notice.
        const failed = typeof value === 'object' && value !== null
          && 'ok' in value && (value as { ok: unknown }).ok === false;
        return {
          ...(failed ? { isError: true as const } : {}),
          content: [{ type: 'text', text: JSON.stringify(value ?? null) }],
        };
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    });
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: await this.resources() }));
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const found = (await this.resources()).find((resource) => resource.uri === request.params.uri);
      if (!found) throw new Error(`Unknown resource: ${request.params.uri}`);
      return { contents: [{ uri: found.uri, mimeType: found.mimeType, text: found.text }] };
    });
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: await this.prompts() }));
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const prompt = (await this.promptRecords()).find((candidate) => candidate.name === request.params.name);
      if (!prompt) throw new Error(`Unknown prompt: ${request.params.name}`);
      return { description: prompt.description, messages: [{ role: 'user', content: { type: 'text', text: prompt.agent.instruct } }] };
    });
  }

  private async resources(): Promise<Array<{ uri: string; name: string; mimeType: string; description: string; text: string }>> {
    const result: Array<{ uri: string; name: string; mimeType: string; description: string; text: string }> = [];
    for (const space of await this.ctx.spaces()) {
      const base = `lmspace://${encodeURIComponent(space.id)}`;
      result.push({ uri: `${base}/package.json`, name: `${space.id} package.json`, mimeType: 'application/json', description: 'Space manifest', text: JSON.stringify(space.manifest ?? null, null, 2) });
      for (const agent of space.agents) {
        const agentBase = `${base}/agents/${encodeURIComponent(agent.slug)}`;
        result.push({ uri: `${agentBase}/charter.md`, name: `${agent.ref} charter`, mimeType: 'text/markdown', description: 'Agent charter', text: agent.charter });
        result.push({ uri: `${agentBase}/instruct.md`, name: `${agent.ref} instructions`, mimeType: 'text/markdown', description: 'Agent instructions', text: agent.instruct });
        for (const ref of agent.knowledge) {
          const field = findKnowledgeField(space, ref);
          if (!field) continue;
          result.push({ uri: `${agentBase}/knowledge/${ref.split('/').map(encodeURIComponent).join('/')}/index.md`, name: `${agent.ref} knowledge ${field.ref}`, mimeType: 'text/markdown', description: 'Knowledge field index', text: field.description ?? '' });
        }
      }
    }
    return result;
  }

  private async promptRecords(): Promise<Array<{ name: string; description: string; agent: Agent }>> {
    const used = new Set<string>();
    const result: Array<{ name: string; description: string; agent: Agent }> = [];
    for (const space of await this.ctx.spaces()) for (const agent of space.agents) {
      // Include space id so same slugs remain unique and predictable.
      const name = `${slugPart(space.id)}__${slugPart(agent.slug)}`;
      if (used.has(name)) throw new Error(`Duplicate MCP prompt name: ${name}`);
      used.add(name);
      result.push({ name, description: `Adopt ${agent.title} (${agent.ref})`, agent });
    }
    return result;
  }

  private async prompts(): Promise<Array<{ name: string; description: string }>> {
    return (await this.promptRecords()).map(({ name, description }) => ({ name, description }));
  }
}

/**
 * Every tool group, statically imported.
 *
 * This used to be a list of module paths behind a tolerant dynamic `import()`, so that
 * groups could land one at a time while four tracks built them in parallel. That
 * scaffolding then hid a real bug: the paths still carried `.js` extensions, which Node's
 * native type stripping cannot resolve to `.ts`, so `functions` failed to load and the
 * "missing module" branch swallowed it — the active agent silently had no function tools
 * and nothing anywhere reported an error. Static imports make that a COMPILE error.
 */
async function loadToolGroups(): Promise<ToolGroup[]> {
  return [
    discoveryTools,
    functionTools,
    knowledgeTools,
    tasklistTools,
    delegationTools,
    authoringTools,
  ];
}


function toolError(message: string) {
  return { isError: true as const, content: [{ type: 'text' as const, text: message }] };
}
function logError(error: unknown): void { process.stderr.write(`[mcp-space] ${error instanceof Error ? error.message : String(error)}\n`); }
function slugPart(value: string): string { return value.replace(/[^A-Za-z0-9_-]/g, '-'); }
function findKnowledgeField(space: Space, ref: string): KnowledgeField | undefined {
  const [domainName, fieldName] = ref.split('/');
  return space.knowledge.find((domain) => domain.name === domainName)?.fields.find((field) => field.name === fieldName);
}

export { SpaceServerContext } from './context.ts';
