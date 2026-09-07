import { resolveDelegateMountsForSpace } from './resolve.js'

/**
 * Self-loading dsh plugin (architecture pivot, see dsh/packages/README.md): given `{ spaceDir,
 * agentSlug, registry }`, loads the space itself, resolves `agentSlug`'s `canDelegateTo` against
 * `registry` (every delegatable agent across every loaded space, keyed by slug), and mounts one
 * `@deepseek-ai/dsh-tool-subagent` per resolved target — bound to that target's own
 * `lmthing-preset-<slug>` provider (registered ONCE for the whole profile by
 * `@lmthing/dsh-subagent-preset`'s `lmthing-subagent-preset-roster` plugin — see that package's
 * doc comment for why registration can't happen here, per-delegator).
 *
 * Part A2 (see dsh/PROGRESS.md): this plugin used to ALSO mount the target's own
 * `@lmthing/dsh-space-functions` into the delegator's own scope (so there was something for
 * `toolFilter` to narrow down to) — the real union-of-tools fidelity gap. That's gone: a delegated
 * child now recomposes onto the target's OWN standing preset (its own tools, its own persona,
 * nothing of the delegator's), so the delegator's preset holds only its own tools + the
 * `delegate_*` launchers.
 *
 * config: { spaceDir: string, agentSlug: string, registry: Record<string, { agent: object, spaceDir: string }> }
 *
 * Every `ctx.plugin()` call below is `await`ed — see `@lmthing/dsh-space`'s doc comment for why an
 * unawaited call on an async child silently misses the first request's tool-schema snapshot.
 */
export const name = 'lmthing-space-delegate'

export async function apply(ctx, config) {
  const mounts = await resolveDelegateMountsForSpace(config.spaceDir, config.agentSlug, config.registry ?? {})
  const toolSubagent = await import('@deepseek-ai/dsh-tool-subagent')

  for (const mount of mounts) {
    await ctx.plugin(toolSubagent.default ?? toolSubagent, mount.subagentConfig)
  }
}

export { resolveDelegateTargets, resolveDelegateMounts, resolveDelegateMountsForSpace } from './resolve.js'
