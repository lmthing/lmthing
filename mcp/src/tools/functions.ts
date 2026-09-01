import { invokeFn } from '../exec/invoke.ts';
import type { Agent, JsonSchema, Space, SpaceFn } from '../format/types.ts';
import type { ServerCtx, ToolDef, ToolGroup } from './ctx.ts';

const emptyObject: JsonSchema = { type: 'object', properties: {} };

/** Projects only the active agent's declared space functions onto MCP tools. */
export const tools: ToolGroup = (ctx) => {
  const tools: ToolDef[] = [listFunctionsTool(ctx), getSchemaTool(ctx), listCapabilitiesTool(ctx)];
  const agent = ctx.activeAgent();
  const space = ctx.activeSpace();
  if (!agent || !space) return tools;
  for (const fn of allowedFunctions(agent, space)) {
    tools.push({
      name: fn.name,
      description: fn.description || `Call ${fn.name}.`,
      inputSchema: fn.schema,
      handler: (args) => invokeFn(fn, args),
    });
  }
  return tools;
};

function listFunctionsTool(ctx: ServerCtx): ToolDef {
  return {
    name: 'list_functions',
    description: 'List functions declared by an agent, including their derived schemas and extraction verdicts.',
    inputSchema: refSchema(),
    async handler(args) {
      const resolved = await resolveAgent(ctx, optionalString(args.ref));
      if (!resolved) return [];
      return allowedFunctions(resolved.agent, resolved.space).map((fn) => ({
        name: fn.name, description: fn.description, schema: fn.schema, verdict: fn.verdict,
      }));
    },
  };
}

function getSchemaTool(ctx: ServerCtx): ToolDef {
  return {
    name: 'get_function_schema',
    description: 'Get the full derived JSON Schema for one function declared by the active agent.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Function name.' } }, required: ['name'] },
    async handler(args) {
      const name = optionalString(args.name);
      if (!name) throw new Error('name must be a non-empty string');
      const agent = ctx.activeAgent();
      const space = ctx.activeSpace();
      if (!agent || !space) throw new Error('No active agent is selected');
      const fn = allowedFunctions(agent, space).find((candidate) => candidate.name === name);
      if (!fn) throw new Error(`Function "${name}" is not declared by the active agent`);
      return fn.schema;
    },
  };
}

function listCapabilitiesTool(ctx: ServerCtx): ToolDef {
  return {
    name: 'list_capabilities',
    description: 'List an agent’s capability grants and configuration. Standalone MCP functions do not unlock ambient globals.',
    inputSchema: refSchema(),
    async handler(args) {
      const resolved = await resolveAgent(ctx, optionalString(args.ref));
      if (!resolved) return [];
      return resolved.agent.capabilities.map((capability) => ({
        id: capability.id,
        ...(capability.config === undefined ? {} : { config: capability.config }),
        tools: [],
        note: 'No MCP tool is unlocked: ambient capability globals are unsupported by this standalone server.',
      }));
    },
  };
}

function refSchema(): JsonSchema {
  return { type: 'object', properties: { ref: { type: 'string', description: 'Optional agent ref (<spaceId>/<slug>); defaults to the active agent.' } } };
}

function allowedFunctions(agent: Agent, space: Space): SpaceFn[] {
  const actual = new Map(space.functions.map((fn) => [fn.name, fn]));
  // Capability grants control retired ambient globals, not a function-level permission model.
  // The standalone server provides none of those globals, so declared function names are the sole gate.
  return agent.functions.flatMap((name) => {
    const fn = actual.get(name);
    return fn ? [fn] : [];
  });
}

async function resolveAgent(ctx: ServerCtx, ref: string | undefined): Promise<{ agent: Agent; space: Space } | undefined> {
  if (!ref) {
    const agent = ctx.activeAgent();
    const space = ctx.activeSpace();
    return agent && space ? { agent, space } : undefined;
  }
  const agent = await ctx.agent(ref);
  if (!agent) throw new Error(`Unknown agent "${ref}"`);
  const space = (await ctx.spaces()).find((candidate) => candidate.agents.some((candidateAgent) => candidateAgent.ref === agent.ref));
  if (!space) throw new Error(`No space owns agent "${ref}"`);
  return { agent, space };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}
