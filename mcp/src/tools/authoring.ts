import { join } from 'node:path';
import { createSpace, deleteSpaceFile, validateSpace, writeAgent, writeFunction, writeKnowledge, writeTasklistNode } from '../format/write.ts';
import type { TaskNode } from '../format/types.ts';
import type { WriteTarget } from '../format/write.ts';
import type { ToolDef, ToolGroup } from './ctx.ts';

function string(args: Record<string, unknown>, key: string): string { const value = args[key]; if (typeof value !== 'string' || !value) throw new Error(`${key} must be a non-empty string`); return value; }
/**
 * Resolve a space ref to where a write should land.
 *
 * Accepts `<project>/<id>` or a bare `<id>` when unambiguous; `ctx.space` throws naming both
 * candidates when a bare id exists in two projects, rather than writing into whichever it
 * happened to find first.
 */
async function target(ctx: Parameters<ToolGroup>[0], ref: string): Promise<WriteTarget> {
  const space = await ctx.space(ref);
  if (!space) throw new Error(`Unknown space ${ref} — use list_spaces for the available <project>/<id> refs`);
  return { dir: space.dir, project: space.project };
}
const resultSchema = { type: 'object', properties: {}, additionalProperties: true } as const;

export const tools: ToolGroup = (ctx): ToolDef[] => [
  { name: 'create_space', description: 'Create a minimal parseable space with one agent, in a named project (default: the server default).', inputSchema: { type: 'object', properties: { id: { type: 'string' }, project: { type: 'string', description: 'Target project under .lmthing/. Defaults to the server default project.' } }, required: ['id'], additionalProperties: false }, async handler(args) {
    const project = args.project === undefined ? ctx.defaultProject : string(args, 'project');
    if (project.includes('/') || project === '.' || project === '..') throw new Error(`project must be a single path segment, got: ${project}`);
    // The project directory need not exist yet — creating a space is how a project starts.
    const result = await createSpace(join(ctx.runtimeDir, project, 'spaces'), string(args, 'id'), project);
    if (result.ok) await ctx.reload();
    return result;
  } },
  { name: 'write_agent', description: 'Write an agent instruct.md and optional charter.md, validating the candidate space before commit.', inputSchema: { type: 'object', properties: { space: { type: 'string' }, slug: { type: 'string' }, frontmatter: resultSchema, instruct: { type: 'string' }, charter: { type: 'string' } }, required: ['space', 'slug', 'frontmatter', 'instruct'], additionalProperties: false }, async handler(args) { const result = await writeAgent(await target(ctx, string(args, 'space')), string(args, 'slug'), args.frontmatter, string(args, 'instruct'), args.charter === undefined ? undefined : string(args, 'charter')); if (result.ok) await ctx.reload(); return result; } },
  { name: 'write_function', description: 'Write a TypeScript space function, extract its tool schema, and validate the candidate space.', inputSchema: { type: 'object', properties: { space: { type: 'string' }, name: { type: 'string' }, source: { type: 'string' } }, required: ['space', 'name', 'source'], additionalProperties: false }, async handler(args) { const result = await writeFunction(await target(ctx, string(args, 'space')), string(args, 'name'), string(args, 'source')); if (result.ok) await ctx.reload(); return result; } },
  { name: 'write_knowledge', description: 'Write one knowledge aspect and re-parse the complete candidate space before commit.', inputSchema: { type: 'object', properties: { space: { type: 'string' }, domain: { type: 'string' }, field: { type: 'string' }, option: { type: 'string' }, body: { type: 'string' } }, required: ['space', 'domain', 'field', 'option', 'body'], additionalProperties: false }, async handler(args) { const result = await writeKnowledge(await target(ctx, string(args, 'space')), string(args, 'domain'), string(args, 'field'), string(args, 'option'), string(args, 'body')); if (result.ok) await ctx.reload(); return result; } },
  { name: 'write_tasklist_node', description: 'Write an agent tasklist markdown node and reject unknown dependencies or cycles.', inputSchema: { type: 'object', properties: { space: { type: 'string' }, slug: { type: 'string' }, id: { type: 'string' }, node: resultSchema }, required: ['space', 'slug', 'id', 'node'], additionalProperties: false }, async handler(args) { const raw = args.node; if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('node must be an object'); const node = raw as Omit<TaskNode, 'file' | 'id'>; const result = await writeTasklistNode(await target(ctx, string(args, 'space')), string(args, 'slug'), string(args, 'id'), node); if (result.ok) await ctx.reload(); return result; } },
  { name: 'delete_space_file', description: 'Delete one regular in-space file only if the resulting space still parses.', inputSchema: { type: 'object', properties: { space: { type: 'string' }, path: { type: 'string' } }, required: ['space', 'path'], additionalProperties: false }, async handler(args) { const result = await deleteSpaceFile(await target(ctx, string(args, 'space')), string(args, 'path')); if (result.ok) await ctx.reload(); return result; } },
  { name: 'validate_space', description: 'Re-parse a space and return all format problems rather than only the first.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false }, async handler(args) { return validateSpace(await target(ctx, string(args, 'id'))); } },
];
