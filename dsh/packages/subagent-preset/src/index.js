import { randomUUID } from 'node:crypto'
import { foldConsumedWork } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import {
  appendDelegatedPolicyOverrides,
  assertSubagentMaxDepth,
  captureDelegatedPolicyOverrides,
  childSessionMeta,
  finalAssistantOutput,
  resolveChildAgentOptions,
  resolveChildDepth,
} from '@deepseek-ai/dsh-subagent'

/**
 * A `SubagentProvider` that composes each in-process child from a NAMED PRESET (its own
 * `agentPresets` roster entry, not the calling agent's own preset) — fixing the real fidelity gap
 * documented in `dsh/PROGRESS.md` Part A2: dsh's stock in-process subagent drivers only support
 * `composeFrom()`, which joins the child to whatever standing composition the PARENT already
 * runs on. There is no built-in way to say "run this child under agent X's own preset instead."
 *
 * This is a deliberate, minimal fork of `@deepseek-ai/dsh-subagent-in-process-driver`'s
 * `startInProcessRun`/`drivePublishedRun`/`readResult` (that package exports none of its private
 * helpers, and its own `setup` composes via `applyChildComposition` — persona/toolFilter
 * narrowing of the PARENT's tool set, not a different preset). The only real change from the
 * original:
 *
 *   1. `setup(childCtx)` calls `ctx.agentPresets.composeFrom(childCtx, parent.ctx)` — REQUIRED
 *      first (per `@deepseek-ai/dsh-agent-presets`'s own README: "A subagent's child joins its
 *      parent's standing composition through composeFrom(), never through mount()" — composeFrom
 *      is the only bind that fits inside a synchronous creation window). This temporarily joins
 *      the child to the PARENT's composition, same as the stock driver.
 *   2. AFTER `parent.ctx.agents.create({...})` resolves (the child is published, but has not yet
 *      been sent its first message — `drivePublishedRun`'s `child.followup()`/`child.whenIdle()`
 *      have not run), we `await ctx.agentPresets.recompose(handle.agent.ctx, targetPresetId)` to
 *      RE-LINK the child onto the TARGET's own preset instead. `recompose()`'s own doc is explicit
 *      that this is valid "only while the agent has produced nothing" and that "the CALLER owns
 *      that check" — this is exactly that window: publication is not production, and no message
 *      has been delivered to the child yet.
 *
 * `handle.agent.ctx` is the scope-tagged Cordis `Context` the presets service needs
 * (`Agent.ctx: Context`, confirmed from `@deepseek-ai/dsh-agent`'s own type declarations) — the
 * SAME fiber `setup(childCtx)` ran in, so `scopeOf()` still resolves it correctly.
 *
 * Live-verified against `system-echo`: after recompose, the child's tool schema reflects ONLY the
 * target preset's own tools (not the union of parent + target, the documented fidelity gap in
 * `dsh/packages/space-delegate`'s original `resolve.js`).
 */

/** Error used when cancellation wins before the child publication boundary — same wording as the
 *  original driver's private helper, kept here since it isn't exported. */
function prePublicationAbort() {
  return new Error('subagent request was aborted before child publication')
}

/** Append one one-shot descriptor inside the child's initial turn before its first request —
 *  ported verbatim from the original driver (not exported there). */
function attachDescriptorAppend(childCtx, descriptor) {
  let appended = false
  childCtx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    if (!appended && decision.kind === 'enter') {
      appended = true
      agent.session.append('subagent/descriptor', descriptor)
    }
    return decision
  })
}

/** Map a session turn outcome to the subagent seam's terminal vocabulary — ported verbatim. */
function toStopReason(reason) {
  switch (reason?.kind) {
    case 'completed': return 'completed'
    case 'max-tokens': return 'max-tokens'
    case 'aborted': return 'aborted'
    case 'blocked': return 'refusal'
    default: return 'error'
  }
}

/** Read one settled child's result from events after its activation boundary — ported verbatim
 *  (no structured-output support: this provider declares `capabilities.outputSchema: false`, so
 *  the service rejects a request needing it before ever calling `start()`). */
function readResult(child, boundary, cancelled) {
  const own = child.session.events.slice(boundary)
  const lastEnd = foldConsumedWork(own).end
  const output = finalAssistantOutput(own) ?? []
  const recorded = toStopReason(lastEnd?.data.reason)
  const stopReason = cancelled && recorded !== 'completed' ? 'aborted' : recorded
  return { output, stopReason }
}

/** Wrap a published child in the run lifecycle — ported verbatim from the original driver's
 *  private `drivePublishedRun`. */
function drivePublishedRun(handle, signal, prompt, childId, boundary) {
  const child = handle.agent
  const flags = { cancelled: false }
  const onAbort = () => {
    flags.cancelled = true
    child.cancel({ kind: 'parent' })
  }
  signal.addEventListener('abort', onAbort, { once: true })
  if (signal.aborted) onAbort()
  const result = (async () => {
    try {
      if (!flags.cancelled) {
        child.followup(createUserMessage({ content: prompt, source: { kind: 'user' } }))
        await child.whenIdle()
      }
      return readResult(child, boundary, flags.cancelled)
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
  })()
  return {
    id: childId,
    localAgent: child,
    result,
    async dispose() {
      signal.removeEventListener('abort', onAbort)
      flags.cancelled = true
      const disposal = (await Promise.allSettled([handle.dispose(), result]))[0]
      if (disposal.status === 'rejected') throw disposal.reason
    },
  }
}

/**
 * Register one `SubagentProvider` under `name` whose children always compose from the
 * `targetPresetId` preset (via `ctx.agentPresets`), regardless of which preset the calling agent
 * runs on. `ctx` must inject both `subagents` and `agentPresets`.
 *
 * One provider instance targets exactly one preset — register one per delegation target (e.g.
 * `lmthing-preset-echo`, `lmthing-preset-researcher`), each a distinctly-named row a
 * `dsh-tool-subagent` instance can bind to via its `provider` config field. This sidesteps the
 * real constraint that `SubagentStartRequest` (the model-facing tool's request shape) has no
 * generic "extra config" field to carry a target preset id through — the target is closed over at
 * REGISTRATION time instead, not threaded through the per-call request.
 *
 * Declares `capabilities: { persona: false, toolFilter: false, outputSchema: false, depthLimit:
 * true }` — persona/toolFilter narrow the PARENT's tool set (the old union-of-tools fidelity gap
 * this whole mechanism exists to replace); a preset-composed child's tools/persona come from its
 * OWN preset instead, so accepting either would silently offer two contradictory narrowing
 * mechanisms. A `dsh-tool-subagent` config that requests persona/toolFilter against this provider
 * is rejected by the subagent service itself, before `start()` is ever called (capability
 * mismatch), matching the seam's own fail-loud contract.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ name: string, targetPresetId: string }} config
 * @returns {() => void} the Cordis effect disposer (unregisters the provider).
 */
export function registerPresetSubagentProvider(ctx, config) {
  const { name, targetPresetId } = config
  return ctx.subagents.registerProvider({
    name,
    capabilities: { persona: false, toolFilter: false, outputSchema: false, depthLimit: true },
    inheritsParentContext: false,
    async start(request) {
      assertSubagentMaxDepth(request.maxDepth)
      if (request.signal.aborted) throw prePublicationAbort()
      const parent = request.parent
      const childDepth = resolveChildDepth(parent, request.maxDepth)
      const childId = SessionId(randomUUID())
      const inherited = captureDelegatedPolicyOverrides(parent)

      const setup = (childCtx) => {
        appendDelegatedPolicyOverrides(childCtx.agent.session, inherited)
        // Required first bind (synchronous creation window) — see the module doc comment.
        ctx.agentPresets.composeFrom(childCtx, parent.ctx)
        attachDescriptorAppend(childCtx, request.descriptor)
      }

      const handle = await parent.ctx.agents.create({
        sessionId: childId,
        meta: childSessionMeta(parent, childDepth, 0),
        agentOptions: resolveChildAgentOptions(parent, request.agentOptions, childDepth),
        signal: request.signal,
        setup,
      })

      // THE fix: re-link onto the TARGET's own preset before the child is sent anything —
      // publication is not production, so this satisfies recompose()'s "produced nothing" rule.
      await ctx.agentPresets.recompose(handle.agent.ctx, targetPresetId)

      return drivePublishedRun(handle, request.signal, request.prompt, childId, 0)
    },
  })
}

/**
 * Register one preset-composing `SubagentProvider` per agent slug in `targets` — `lmthing-preset-
 * <slug>` for each, targeting that same slug's preset.
 *
 * MUST be mounted exactly ONCE per profile, at the base/host composition level — NOT once per
 * delegating agent's own preset. `ctx.subagents.registerProvider()` registers into a single
 * process-global provider map (`registerProvider`'s own implementation: `this.providers.set(name,
 * provider)`), and throws `DUPLICATE_PROVIDER` on a second registration under the same name. If
 * two different delegator agents both listed the same target in their `canDelegateTo`, and each
 * delegator's own `@lmthing/dsh-space-delegate` mount tried to register that target's provider
 * itself, the second delegator to load would crash the whole space load. Registering every
 * target's provider once, up front, for the whole profile — and having `space-delegate` only USE
 * the already-registered name — avoids that collision entirely.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {string[]} targets - every agent slug that might be a delegation target anywhere in this profile.
 */
export function registerPresetSubagentProviders(ctx, targets) {
  for (const slug of targets) {
    registerPresetSubagentProvider(ctx, { name: `lmthing-preset-${slug}`, targetPresetId: slug })
  }
}

/**
 * A mountable Cordis plugin wrapper around {@link registerPresetSubagentProviders}, for a profile
 * patch to `ctx.plugin()` once — `config: { targets: string[] }`.
 */
export const name = 'lmthing-subagent-preset-roster'
export const inject = ['subagents', 'agentPresets']

export async function apply(ctx, config) {
  registerPresetSubagentProviders(ctx, config.targets ?? [])
}
