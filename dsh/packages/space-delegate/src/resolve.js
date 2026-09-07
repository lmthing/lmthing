import { loadSpace } from '@lmthing/dsh-space-format'

/**
 * Resolve one agent's `canDelegateTo` (a tri-state — see space-format's
 * AgentDef doc comment, ported unchanged) against a registry of delegatable
 * agents that may span MULTIPLE spaces — the normal case in LMThing too
 * (THING's specialists each live in their own system space). Phase 1 does
 * not resolve `space/agent#action`, `npm:`, or `registered:*` refs (roadmap
 * — see dsh/packages/README.md); they're excluded, not silently dropped.
 *
 * @param {{ slug: string, canDelegateTo?: string[] }} agent
 * @param {Record<string, { agent: object, spaceDir: string }>} registry — every delegatable agent, keyed by slug (the delegator itself may or may not be present; it is always excluded from the result)
 * @returns {string[]} target slugs, excluding the agent itself
 */
export function resolveDelegateTargets(agent, registry) {
  const others = Object.keys(registry).filter((slug) => slug !== agent.slug)

  if (agent.canDelegateTo === undefined) return others // omitted = unrestricted
  if (agent.canDelegateTo.includes('*')) return others
  return agent.canDelegateTo.filter((slug) => others.includes(slug))
}

/**
 * Build the mount specs the delegator's plugin needs for each resolved target — Part A2's
 * isolated-preset design (see dsh/PROGRESS.md), replacing the original union-of-tools bridge this
 * doc comment used to describe.
 *
 * dsh's STOCK in-process subagent drivers only support `composeFrom()` — a spawned/forked child
 * JOINS THE PARENT'S OWN standing composition (`@deepseek-ai/dsh-subagent`'s own README, "Composing
 * a child agent"); there is no built-in "run a child under a DIFFERENT preset" at delegation time.
 * `@lmthing/dsh-subagent-preset` fixes that: it's a `SubagentProvider` that, after the child is
 * published (but before it's sent anything), calls `ctx.agentPresets.recompose(childCtx,
 * targetPresetId)` to re-link it onto the TARGET's own standing preset — see that package's doc
 * comment for the exact mechanism and why it's safe (recompose is valid while an agent "has
 * produced nothing"; publication is not production).
 *
 * One provider instance targets exactly one preset (there's no per-call "extra config" slot on
 * `SubagentStartRequest` to carry a target id through), so each resolved target gets its OWN
 * uniquely-named provider (`lmthing-preset-<slug>`) plus its own `@deepseek-ai/dsh-tool-subagent`
 * row bound to it. Neither row carries `persona`/`toolFilter` any more — the target's own preset
 * (mounted by `@lmthing/dsh-preset-roster`) already supplies both, so the delegator's OWN preset no
 * longer needs the target's functions mounted into its scope at all. This is the real fix: a
 * delegator's preset holds only ITS OWN tools + the `delegate_*` launchers, never the union.
 *
 * Pure and unit-testable without Cordis — the plugin's `apply()` turns each spec into a provider
 * registration + one `ctx.plugin()` call.
 *
 * @param {{ slug: string, canDelegateTo?: string[] }} delegatorAgent
 * @param {Record<string, { agent: { slug: string }, spaceDir: string }>} registry
 * @returns {{ slug: string, providerName: string, subagentConfig: object }[]}
 */
export function resolveDelegateMounts(delegatorAgent, registry) {
  const targets = resolveDelegateTargets(delegatorAgent, registry)
  return targets.map((slug) => ({
    slug,
    providerName: `lmthing-preset-${slug}`,
    subagentConfig: {
      provider: `lmthing-preset-${slug}`,
      toolName: `delegate_${slug}`,
    },
  }))
}

/**
 * @param {string} spaceDir
 * @param {string} agentSlug
 * @param {Record<string, { agent: object, spaceDir: string }>} registry
 * @returns {Promise<{ slug: string, providerName: string, subagentConfig: object }[]>}
 */
export async function resolveDelegateMountsForSpace(spaceDir, agentSlug, registry) {
  const space = await loadSpace(spaceDir)
  const agent = space.agents[agentSlug]
  if (!agent) {
    throw new Error(`@lmthing/dsh-space-delegate: agent "${agentSlug}" not found in space at "${spaceDir}"`)
  }
  return resolveDelegateMounts(agent, registry)
}
