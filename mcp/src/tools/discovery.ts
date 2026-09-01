import type { Agent, JsonSchema, KnowledgeField, Space, SpaceFn } from '../format/types.ts';
import type { ToolGroup } from './ctx.ts';

const emptyObject: JsonSchema = { type: 'object', properties: {}, additionalProperties: false };
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
    /**
     * The entry point for a cold client: one server serves the whole runtime, so the first
     * question is which projects exist. A project with no `spaces/` yet is still listed —
     * that is how a caller learns it can create one there.
     */
    name: 'list_projects',
    description: 'List every project under the runtime root, with how many spaces each holds.',
    inputSchema: emptyObject,
    async handler() {
      return (await ctx.projects()).map((project) => ({
        id: project.id,
        dir: project.dir,
        spacesDir: project.spacesDir,
        spaceCount: project.spaces.length,
        spaces: project.spaces.map((space) => space.ref),
        isDefault: project.id === ctx.defaultProject,
      }));
    },
  },
  {
    name: 'list_spaces',
    description: 'List spaces across every project under the runtime root. Optionally filter to one project.',
    inputSchema: { type: 'object', properties: { project: { type: 'string', description: 'Only spaces in this project.' } }, additionalProperties: false },
    async handler(args) {
      const only = args.project === undefined ? undefined : String(args.project);
      const all = await ctx.spaces();
      return all.filter((space) => only === undefined || space.project === only).map((space) => ({
        // `ref` is the addressable identity; `id` alone is NOT unique across projects.
        ref: space.ref,
        id: space.id,
        project: space.project,
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
    inputSchema: refSchema,
    async handler(args) {
      // `ref` is the addressable identity (`<project>/<id>`); a bare id is still accepted when
      // unambiguous — ctx.space() refuses rather than guesses when two projects share one.
      const ref = requiredString(args, 'ref');
      const space = await ctx.space(ref);
      if (!space) throw new Error(`Unknown space: ${ref}`);
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
      // The agent carries its own address; slicing the caller's ref would break for the
      // two-part form, which no longer encodes the project.
      const space = await ctx.space(`${agent.project}/${agent.space}`);
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
