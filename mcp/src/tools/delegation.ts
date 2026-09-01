import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { Agent, Space } from '../format/types.ts';
import type { ToolDef, ToolGroup } from './ctx.ts';

const emptyObject = { type: 'object', properties: {}, additionalProperties: false } as const;
const marker = 'lmthing-mcp-space';
function active(ctx: Parameters<ToolGroup>[0]) { const agent = ctx.activeAgent(); if (!agent) throw new Error('No active agent selected'); return agent; }
function stripAction(ref: string): string { return ref.split('#', 1)[0]!; }
function resolvedTools(space: Space, agent: Agent): string[] { const declared = new Set(agent.functions); return space.functions.filter((fn) => declared.has(fn.name)).map((fn) => fn.name); }

/**
 * Normalize a delegate ref against the delegating agent. The format's native two-part form
 * (`<space>/<slug>`) is PROJECT-LOCAL — it means the source agent's own project, which is
 * what every existing space's frontmatter means by it. Only a three-part
 * `<project>/<space>/<slug>` ref crosses projects.
 */
function delegateRef(entry: string, source: Agent): string {
  const bare = stripAction(entry);
  return bare.split('/').length === 2 ? `${source.project}/${bare}` : bare;
}

async function delegates(ctx: Parameters<ToolGroup>[0]): Promise<Array<{ space: Space; agent: Agent }>> {
  const source = active(ctx); const spaces = await ctx.spaces();
  const all = spaces.flatMap((space) => space.agents.map((agent) => ({ space, agent })));
  if (source.canDelegateTo === undefined || source.canDelegateTo.includes('*')) return all;
  const allowed = new Set(source.canDelegateTo.map((entry) => delegateRef(entry, source)));
  return all.filter(({ agent }) => allowed.has(agent.ref));
}
function requiredString(args: Record<string, unknown>, key: string): string { const value = args[key]; if (typeof value !== 'string' || !value) throw new Error(`${key} must be a non-empty string`); return value; }

export const tools: ToolGroup = (ctx): ToolDef[] => [
  { name: 'list_delegates', description: 'List targets the active agent may delegate to; omitted policy means unrestricted, while [] means none.', inputSchema: emptyObject, async handler() {
    return (await delegates(ctx)).map(({ space, agent }) => ({ ref: agent.ref, title: agent.title, tools: resolvedTools(space, agent) }));
  } },
  { name: 'get_delegate', description: 'Get a permitted delegate’s instructions and resolved standalone tool list.', inputSchema: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'], additionalProperties: false }, async handler(args) {
    // Accept either form of the ref: the qualified one list_delegates returns, or the
    // project-local one the frontmatter itself uses.
    const ref = requiredString(args, 'ref'); const wanted = delegateRef(ref, active(ctx));
    const target = (await delegates(ctx)).find(({ agent }) => agent.ref === ref || agent.ref === wanted);
    if (!target) throw new Error(`Delegate ${ref} is not available to the active agent`);
    return { ref: target.agent.ref, title: target.agent.title, instruct: target.agent.instruct, tools: resolvedTools(target.space, target.agent) };
  } },
  /**
   * A subagent's `tools` list must use CLAUDE CODE's tool names, not the space's function
   * names. An MCP tool is `mcp__<server>__<fn>`, and from Claude Code 2.1.208 an unresolvable
   * entry is FATAL — the subagent refuses to launch rather than starting with fewer tools. So
   * emitting a bare `greet` produced files that could never run.
   *
   * `<server>` is the key the CLIENT chose in its own `.mcp.json`; this server cannot know its
   * own alias, so it is a parameter (default `space`, matching this repo's config). Pass
   * `serverName` if you registered it under a different key.
   *
   * Note what a narrowed subagent gives up: listing only MCP tools means no Read/Bash/Edit.
   * That is the honest reading of `canDelegateTo` + `functions` as a privilege boundary — omit
   * `tools` instead (set `inheritTools`) if you want a delegate that can also do general work.
   */
  { name: 'export_claude_subagents', description: 'Export permitted delegates as Claude Code subagent files, with MCP-qualified tool names.', inputSchema: { type: 'object', properties: { outDir: { type: 'string' }, serverName: { type: 'string', description: "The key this server is registered under in the client's .mcp.json. Default 'space'." }, inheritTools: { type: 'boolean', description: 'Omit the tools list entirely so the delegate inherits every available tool. Default false.' } }, additionalProperties: false }, async handler(args) {
    const rawOutDir = args.outDir === undefined ? '.claude/agents' : requiredString(args, 'outDir');
    const outDir = isAbsolute(rawOutDir) ? rawOutDir : resolve(rawOutDir);
    const serverName = args.serverName === undefined ? 'space' : requiredString(args, 'serverName');
    if (!/^[A-Za-z0-9_-]+$/.test(serverName)) throw new Error(`serverName must match [A-Za-z0-9_-]+, got: ${serverName}`);
    const inheritTools = args.inheritTools === true;
    await mkdir(outDir, { recursive: true });
    const written: string[] = []; const refused: string[] = [];
    for (const { space, agent } of await delegates(ctx)) {
      const filename = `${space.id}-${agent.slug}.md`; const file = join(outDir, filename);
      try {
        const existing = await readFile(file, 'utf8');
        if (!existing.includes(`generated-by: ${marker}`)) { refused.push(file); continue; }
      } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const tools = resolvedTools(space, agent).map((tool) => `mcp__${serverName}__${tool}`);
      // An empty `tools:` would leave the delegate with nothing at all, so a delegate that
      // declares no functions inherits instead — a useless subagent is worse than a broad one.
      const toolsField = inheritTools || tools.length === 0
        ? ''
        : `tools:\n${tools.map((tool) => `  - ${tool}`).join('\n')}\n`;
      const content = `---\ngenerated-by: ${marker}\nname: ${space.id}-${agent.slug}\ndescription: ${agent.title.replace(/\n/g, ' ')}\n${toolsField}---\n\n${agent.instruct}`;
      await writeFile(file, content, 'utf8'); written.push(file);
    }
    return { written, refused, serverName, toolPrefix: `mcp__${serverName}__` };
  } },
];
