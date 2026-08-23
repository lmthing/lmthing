import * as spaceFunctions from '@lmthing/dsh-space-functions'
import { resolveDelegateMountsForSpace } from './resolve.js'

/**
 * Self-loading dsh plugin (architecture pivot, see dsh/packages/README.md):
 * given `{ spaceDir, agentSlug, registry }`, loads the space itself,
 * resolves `agentSlug`'s `canDelegateTo` against `registry` (every
 * delegatable agent across every loaded space, keyed by slug — see
 * `resolve.js`'s doc comment for the tri-state semantics and the dsh
 * subagent-preset-joining fidelity gap this works around), and mounts one
 * `@lmthing/dsh-space-functions` + one `@deepseek-ai/dsh-tool-subagent` per
 * resolved target — no external script needs to pre-render these into YAML
 * rows first, unlike the Phase 1 shape this replaces.
 *
 * config: { spaceDir: string, agentSlug: string, registry: Record<string, { agent: object, spaceDir: string }> }
 *
 * Every `ctx.plugin()` call below is `await`ed — see `@lmthing/dsh-space`'s
 * doc comment for why an unawaited call on an async child silently misses
 * the first request's tool-schema snapshot (a real bug this port hit).
 */
export const name = 'lmthing-space-delegate'

export async function apply(ctx, config) {
  const mounts = await resolveDelegateMountsForSpace(config.spaceDir, config.agentSlug, config.registry ?? {})
  const toolSubagent = await import('@deepseek-ai/dsh-tool-subagent')

  for (const mount of mounts) {
    if (mount.functionsConfig) {
      await ctx.plugin(spaceFunctions, mount.functionsConfig)
    }
    await ctx.plugin(toolSubagent.default ?? toolSubagent, mount.subagentConfig)
  }
}

export { resolveDelegateTargets, resolveDelegateMounts, resolveDelegateMountsForSpace } from './resolve.js'
