import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { Agent, Space } from '../format/types.ts';
import type { ToolDef, ToolGroup } from './ctx.ts';

const emptyObject = { type: 'object', properties: {}, additionalProperties: false } as const;
const marker = 'lmthing-mcp-space';
function active(ctx: Parameters<ToolGroup>[0]) { const agent = ctx.activeAgent(); if (!agent) throw new Error('No active agent selected'); return agent; }
function stripAction(ref: string): string { return ref.split('#', 1)[0]!; }
function resolvedTools(space: Space, agent: Agent): string[] { const declared = new Set(agent.functions); return space.functions.filter((fn) => declared.has(fn.name)).map((fn) => fn.name); }

async function delegates(ctx: Parameters<ToolGroup>[0]): Promise<Array<{ space: Space; agent: Agent }>> {
  const source = active(ctx); const spaces = await ctx.spaces();
  const all = spaces.flatMap((space) => space.agents.map((agent) => ({ space, agent })));
  if (source.canDelegateTo === undefined || source.canDelegateTo.includes('*')) return all;
  const allowed = new Set(source.canDelegateTo.map(stripAction));
  return all.filter(({ agent }) => allowed.has(agent.ref));
}
function requiredString(args: Record<string, unknown>, key: string): string { const value = args[key]; if (typeof value !== 'string' || !value) throw new Error(`${key} must be a non-empty string`); return value; }

export const tools: ToolGroup = (ctx): ToolDef[] => [
  { name: 'list_delegates', description: 'List targets the active agent may delegate to; omitted policy means unrestricted, while [] means none.', inputSchema: emptyObject, async handler() {
    return (await delegates(ctx)).map(({ space, agent }) => ({ ref: agent.ref, title: agent.title, tools: resolvedTools(space, agent) }));
  } },
  { name: 'get_delegate', description: 'Get a permitted delegate’s instructions and resolved standalone tool list.', inputSchema: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'], additionalProperties: false }, async handler(args) {
    const ref = requiredString(args, 'ref'); const target = (await delegates(ctx)).find(({ agent }) => agent.ref === ref);
    if (!target) throw new Error(`Delegate ${ref} is not available to the active agent`);
    return { ref: target.agent.ref, title: target.agent.title, instruct: target.agent.instruct, tools: resolvedTools(target.space, target.agent) };
  } },
  { name: 'export_claude_subagents', description: 'Export permitted delegates as safely namespaced Claude Code subagent markdown files.', inputSchema: { type: 'object', properties: { outDir: { type: 'string' } }, additionalProperties: false }, async handler(args) {
    const rawOutDir = args.outDir === undefined ? '.claude/agents' : requiredString(args, 'outDir');
    const outDir = isAbsolute(rawOutDir) ? rawOutDir : resolve(rawOutDir);
    await mkdir(outDir, { recursive: true });
    const written: string[] = []; const refused: string[] = [];
    for (const { space, agent } of await delegates(ctx)) {
      const filename = `${space.id}-${agent.slug}.md`; const file = join(outDir, filename);
      try {
        const existing = await readFile(file, 'utf8');
        if (!existing.includes(`generated-by: ${marker}`)) { refused.push(file); continue; }
      } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const tools = resolvedTools(space, agent);
      const content = `---\ngenerated-by: ${marker}\nname: ${space.id}-${agent.slug}\ndescription: ${agent.title.replace(/\n/g, ' ')}\ntools: ${tools.length ? `\n${tools.map((tool) => `  - ${tool}`).join('\n')}` : '[]'}\n---\n\n${agent.instruct}`;
      await writeFile(file, content, 'utf8'); written.push(file);
    }
    return { written, refused };
  } },
];
