import type { Agent, JsonSchema, KnowledgeField, Space, SpaceFn } from '../format/types.ts';
import type { ToolGroup } from './ctx.ts';

const emptyObject: JsonSchema = { type: 'object', properties: {}, additionalProperties: false };
const idSchema: JsonSchema = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false };
const refSchema: JsonSchema = { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'], additionalProperties: false };

function spaceParts(space: Space): string[] {
  const parts: string[] = [];
  if (space.agents.length > 0) parts.push('agents');
  if (space.functions.length > 0) parts.push('functions');
  if (space.knowledge.length > 0) parts.push('knowledge');
  if (Object.keys(space.tasklists).length > 0) parts.push('tasklists');
  return parts;
}

function functionSummary(fn: SpaceFn): object {
  return { name: fn.name, description: fn.description, verdict: fn.verdict };
}

function fieldSummary(field: KnowledgeField): object {
  return { name: field.name, ref: field.ref, description: field.description, options: field.options.map((option) => ({ name: option.name, ref: option.ref, title: option.title, description: option.description })) };
}

function agentSummary(agent: Agent): object {
  return {
    ref: agent.ref,
    slug: agent.slug,
    title: agent.title,
    functions: agent.functions,
    capabilities: agent.capabilities,
    // undefined intentionally survives here: JSON serialization omits it, preserving omitted != [].
    canDelegateTo: agent.canDelegateTo,
    actions: agent.actions,
  };
}

export const tools: ToolGroup = (ctx) => [
  {
    name: 'list_spaces',
    description: 'List all LMThing spaces discovered under the configured spaces directory.',
    inputSchema: emptyObject,
    async handler() {
      return (await ctx.spaces()).map((space) => ({
        id: space.id,
        dir: space.dir,
        agentCount: space.agents.length,
        has: spaceParts(space),
        unsupported: space.unsupported,
      }));
    },
  },
  {
    name: 'describe_space',
    description: 'Describe one LMThing space, including its parsed format data.',
    inputSchema: idSchema,
    async handler(args) {
      const id = requiredString(args, 'id');
      const space = await ctx.space(id);
      if (!space) throw new Error(`Unknown space: ${id}`);
      return {
        id: space.id,
        dir: space.dir,
        agents: space.agents.map(agentSummary),
        functions: space.functions.map(functionSummary),
        knowledge: space.knowledge.map((domain) => ({ name: domain.name, description: domain.description, fields: domain.fields.map(fieldSummary) })),
        tasklists: Object.keys(space.tasklists),
        manifest: space.manifest,
        unsupported: space.unsupported,
      };
    },
  },
  {
    name: 'list_agents',
    description: 'List every agent in every discovered LMThing space.',
    inputSchema: emptyObject,
    async handler() {
      return (await ctx.spaces()).flatMap((space) => space.agents.map(agentSummary));
    },
  },
  {
    name: 'describe_agent',
    description: 'Describe an agent and the functions it can actually use in this standalone server.',
    inputSchema: refSchema,
    async handler(args) {
      const ref = requiredString(args, 'ref');
      const agent = await ctx.agent(ref);
      if (!agent) throw new Error(`Unknown agent reference: ${ref}`);
      const spaceId = ref.slice(0, ref.lastIndexOf('/'));
      const space = await ctx.space(spaceId);
      if (!space) throw new Error(`Agent ${ref} has no owning space`);
      const declared = new Set(agent.functions);
      // Capabilities grant unsupported retired-runtime globals, not standalone space functions.
      const resolvedFunctions = space.functions.filter((fn) => declared.has(fn.name)).map(functionSummary);
      return {
        ref: agent.ref,
        slug: agent.slug,
        title: agent.title,
        charter: agent.charter,
        instruct: agent.instruct,
        functions: agent.functions,
        knowledge: agent.knowledge,
        capabilities: agent.capabilities,
        canDelegateTo: agent.canDelegateTo,
        actions: agent.actions,
        resolvedTools: resolvedFunctions,
      };
    },
  },
  {
    name: 'get_active_agent',
    description: 'Get the currently selected agent reference, or null when none is selected.',
    inputSchema: emptyObject,
    async handler() { return ctx.activeAgent()?.ref ?? null; },
  },
  {
    name: 'set_agent',
    description: 'Select the active agent by <spaceId>/<slug>.',
    inputSchema: refSchema,
    async handler(args) {
      const ref = requiredString(args, 'ref');
      await ctx.setActiveAgent(ref);
      return { ref };
    },
  },
];

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${key} must be a non-empty string`);
  return value;
}
