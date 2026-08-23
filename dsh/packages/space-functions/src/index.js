import { pathToFileURL } from 'node:url'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolveFunctionTools } from './resolve.js'

/**
 * Self-loading dsh plugin (architecture pivot, see dsh/packages/README.md):
 * given `{ spaceDir, agentSlug }`, loads the space itself (via
 * `resolveFunctionTools`) and registers every function the agent declares as
 * a real dsh tool — no external script needs to pre-compute a
 * `functions: [{name, file}]` list first, unlike the Phase 1 shape this
 * replaces.
 *
 * A ported function module (dsh/system-spaces/*\/functions/<name>.js) is a
 * deliberate, documented extension of the LMThing format for this port: it
 * additionally exports `schema` (a dsh ParameterSchemaSpec) and optionally
 * `description`/`outputSchema`, since dsh tools need a declared JSON Schema
 * and LMThing's original format has none (functions were injected raw into
 * the QuickJS sandbox with whatever signature the author wrote).
 *
 * config: { spaceDir: string, agentSlug: string }
 */
export const name = 'lmthing-space-functions'
export const inject = ['tools']

export async function apply(ctx, config) {
  const tools = await resolveFunctionTools(config.spaceDir, config.agentSlug)

  for (const spec of tools) {
    const mod = await import(pathToFileURL(spec.file).href)
    const fn = mod[spec.name] ?? mod.default
    if (typeof fn !== 'function') {
      throw new Error(`@lmthing/dsh-space-functions: "${spec.name}" (${spec.file}) does not export a callable named "${spec.name}" or a default export`)
    }

    ctx.tools.register(defineTool({
      name: spec.name,
      description: mod.description ?? `LMThing space function "${spec.name}"`,
      parameters: mod.schema ?? {},
      output: {
        schema: mod.outputSchema ?? { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
      },
      async execute(args, exec) {
        return await fn(args, exec)
      },
    }))
  }
}

export { resolveFunctionTools }
