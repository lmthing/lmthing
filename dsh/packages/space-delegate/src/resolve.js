import { loadSpace } from '@lmthing/dsh-space-format'
import { buildPersonaText } from '@lmthing/dsh-space-persona'

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
 * Build the mount specs the delegator's plugin needs for each resolved
 * target, given dsh's actual in-process subagent model: a spawned/forked
 * child JOINS THE PARENT'S OWN PRESET rather than mounting a distinct one
 * (dsh-subagent README, "Composing a child agent"). There is no dsh
 * mechanism for "run a child under a completely different preset" at
 * delegation time — `persona` and `toolFilter` only override and narrow what
 * the parent already has registered.
 *
 * So a faithful bridge has to make the target's OWN tools reachable from the
 * delegator's scope first (mounting `@lmthing/dsh-space-functions` scoped to
 * the target), then mount one `@deepseek-ai/dsh-tool-subagent` per target
 * that gives the delegated call a distinct persona and narrows
 * (`toolFilter`) down to exactly that target's own functions. This means a
 * delegator's preset ends up holding the UNION of its own + every allowed
 * target's functions, narrowed only at call time — a real fidelity gap
 * against LMThing's per-agent-isolated capability model, noted in
 * dsh/packages/README.md. Pure and unit-testable without Cordis — the
 * plugin's `apply()` is a thin wrapper turning each spec into two
 * `ctx.plugin()` calls.
 *
 * @param {{ slug: string, canDelegateTo?: string[] }} delegatorAgent
 * @param {Record<string, { agent: { slug: string, config: { functions: string[] }, charterBody: string, instructBody: string }, spaceDir: string }>} registry
 * @returns {{ slug: string, functionsConfig: { spaceDir: string, agentSlug: string } | null, subagentConfig: object }[]}
 */
export function resolveDelegateMounts(delegatorAgent, registry) {
  const targets = resolveDelegateTargets(delegatorAgent, registry)
  const mounts = []

  for (const slug of targets) {
    const { agent: target, spaceDir } = registry[slug]

    const hasFunctions = target.config.functions.length > 0
    const subagentConfig = {
      provider: 'spawn',
      toolName: `delegate_${slug}`,
      persona: buildPersonaText(target),
    }
    // An empty allow-list is rejected by dsh-tools ("empty filters reject") —
    // a target with no functions of its own is reached with no narrowing
    // (inherits the delegator's full toolset) rather than muted entirely.
    if (hasFunctions) {
      subagentConfig.toolFilter = { allow: target.config.functions }
    }

    mounts.push({
      slug,
      functionsConfig: hasFunctions ? { spaceDir, agentSlug: target.slug } : null,
      subagentConfig,
    })
  }

  return mounts
}

/**
 * @param {string} spaceDir
 * @param {string} agentSlug
 * @param {Record<string, { agent: object, spaceDir: string }>} registry
 * @returns {Promise<{ slug: string, functionsConfig: { spaceDir: string, agentSlug: string } | null, subagentConfig: object }[]>}
 */
export async function resolveDelegateMountsForSpace(spaceDir, agentSlug, registry) {
  const space = await loadSpace(spaceDir)
  const agent = space.agents[agentSlug]
  if (!agent) {
    throw new Error(`@lmthing/dsh-space-delegate: agent "${agentSlug}" not found in space at "${spaceDir}"`)
  }
  return resolveDelegateMounts(agent, registry)
}
