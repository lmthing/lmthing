import * as spaceFunctions from '@lmthing/dsh-space-functions'
import * as spacePersona from '@lmthing/dsh-space-persona'
import * as spaceDelegate from '@lmthing/dsh-space-delegate'
import * as spaceTasklist from '@lmthing/dsh-space-tasklist'
import * as spaceKnowledge from '@lmthing/dsh-space-knowledge'
import * as spaceComponents from '@lmthing/dsh-space-components'

/**
 * THE umbrella dsh plugin (see dsh/packages/README.md, "Architecture pivot:
 * one dsh plugin per feature"). A profile mounts exactly this, once per
 * agent — nothing else needs to be listed in a profile's `cordis.yml` by
 * hand. `apply()` mounts every feature plugin via `ctx.plugin()`, each
 * independently `{ spaceDir, agentSlug }`-self-loading (space-delegate also
 * takes `registry`). Each feature plugin stays independently importable and
 * unit-testable on its own (a test can mount just `space-functions` without
 * the rest); this plugin's only job is composing them.
 *
 * MUST `await` every nested `ctx.plugin()` call. `Context.plugin()` returns
 * a `Fiber & PromiseLike<Fiber>` that "settles once loading finished"
 * (`registry.d.ts`) — an unawaited call only INITIATES the child's mount and
 * lets this plugin's own (async) `apply()` return before the child's async
 * work (here: `loadSpace()` + dynamic `import()`s) actually finishes
 * registering anything. A synchronous child registers in time regardless
 * (nothing to wait for); an async one like `space-functions` does not — its
 * tools silently missed the first request's tool-schema snapshot, with NO
 * thrown error anywhere (found the hard way: a debug probe registered
 * SYNCHRONOUSLY via a second `ctx.plugin()` hop was visible; the real,
 * asynchronous `space-functions` mount was not, which is what isolated this
 * as a missing-`await` bug rather than any deeper Cordis scoping limit).
 *
 * `mountPersona` (default `true`) exists for one real, documented reason:
 * `@lmthing/dsh-space-persona` mounts `@deepseek-ai/dsh-persona`, which is
 * SCOPE-ONLY — it fails loud unless mounted inside a genuine dsh-agent-preset
 * scope. This port has no `dsh-agent-presets` roster yet (roadmap; Phase 1
 * has exactly one ambient headless agent, see dsh/packages/README.md), so
 * a caller mounting this plugin at the top level of a patch file (no real
 * agent scope exists there) MUST pass `mountPersona: false` and set the
 * agent's persona the only way that's actually available today — the
 * global `system-prompt.persona` CONFIG PATCH on dsh-base's own row, using
 * `resolvePersonaText` (a plain function, no plugin machinery) directly.
 * `scripts/assemble-lmthing-profile.mjs` does exactly this. Once a later
 * phase adds `dsh-agent-presets`, every mount of this plugin happens inside
 * a real per-agent scope and `mountPersona` can default away entirely.
 *
 * `space-tasklist`, `space-knowledge`, and `space-components` are each
 * no-ops (mount, find nothing declared, register nothing) for an agent that
 * doesn't declare a tasklist-backed action, `knowledge:`, or `components:` —
 * see each plugin's own doc comment. Mounting them unconditionally for every
 * agent is therefore safe and does not require checking the agent's config
 * first; the plugins do that check themselves.
 *
 * config: { spaceDir: string, agentSlug: string, registry?: Record<string, { agent: object, spaceDir: string }>, mountPersona?: boolean }
 */
export const name = 'lmthing-space'

export async function apply(ctx, config) {
  const { spaceDir, agentSlug, registry, mountPersona = true } = config

  await ctx.plugin(spaceFunctions, { spaceDir, agentSlug })
  if (mountPersona) {
    await ctx.plugin(spacePersona, { spaceDir, agentSlug })
  }
  await ctx.plugin(spaceDelegate, { spaceDir, agentSlug, registry: registry ?? {} })
  await ctx.plugin(spaceTasklist, { spaceDir, agentSlug })
  await ctx.plugin(spaceKnowledge, { spaceDir, agentSlug })
  await ctx.plugin(spaceComponents, { spaceDir, agentSlug })
}
