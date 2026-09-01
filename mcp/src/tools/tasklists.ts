import { readyNodes } from '../format/dag.ts';
import type { ToolDef, ToolGroup } from './ctx.ts';

const emptyObject = { type: 'object', properties: {}, additionalProperties: false } as const;
function active(ctx: Parameters<ToolGroup>[0]) { const agent = ctx.activeAgent(); const space = ctx.activeSpace(); if (!agent || !space) throw new Error('No active agent selected'); return { agent, space }; }
function string(args: Record<string, unknown>, key: string): string { const value = args[key]; if (typeof value !== 'string' || !value) throw new Error(`${key} must be a non-empty string`); return value; }
function tasklist(ctx: Parameters<ToolGroup>[0], slug: string) { const { space } = active(ctx); const found = space.tasklists[slug]; if (!found) throw new Error(`Unknown tasklist ${slug}; available: ${Object.keys(space.tasklists).join(', ') || '(none)'}`); return found; }

export const tools: ToolGroup = (ctx): ToolDef[] => [
  { name: 'list_tasklists', description: 'List tasklist slugs and the active agent actions that back them.', inputSchema: emptyObject, async handler() {
    const { agent, space } = active(ctx);
    return Object.keys(space.tasklists).sort().map((slug) => ({ slug, actions: agent.actions.filter((action) => action.tasklist === slug).map((action) => ({ id: action.id, label: action.label, description: action.description })) }));
  } },
  { name: 'get_tasklist', description: 'Get the parsed tasklist DAG; this server never executes it.', inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'], additionalProperties: false }, async handler(args) { return tasklist(ctx, string(args, 'slug')); } },
  { name: 'get_tasklist_node', description: 'Get one tasklist node and its client-walkable dependency metadata.', inputSchema: { type: 'object', properties: { slug: { type: 'string' }, id: { type: 'string' } }, required: ['slug', 'id'], additionalProperties: false }, async handler(args) {
    const dag = tasklist(ctx, string(args, 'slug')); const id = string(args, 'id'); const node = dag.nodes.find((item) => item.id === id);
    if (!node) throw new Error(`Unknown node ${id} in tasklist ${dag.slug}; available: ${dag.nodes.map((item) => item.id).join(', ') || '(none)'}`);
    return { id: node.id, title: node.title, body: node.body, dependsOn: node.dependsOn, condition: node.condition, forEach: node.forEach, output: node.output };
  } },
  { name: 'next_tasklist_nodes', description: 'Return uncompleted nodes whose dependencies are all completed.', inputSchema: { type: 'object', properties: { slug: { type: 'string' }, completed: { type: 'array', items: { type: 'string' } } }, required: ['slug', 'completed'], additionalProperties: false }, async handler(args) {
    const completed = args.completed; if (!Array.isArray(completed) || completed.some((id) => typeof id !== 'string')) throw new Error('completed must be an array of strings');
    return readyNodes(tasklist(ctx, string(args, 'slug')), completed as string[]);
  } },
];
