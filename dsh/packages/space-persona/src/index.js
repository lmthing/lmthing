import { resolvePersonaText } from './resolve.js'

/**
 * Self-loading dsh plugin (architecture pivot, see dsh/packages/README.md):
 * given `{ spaceDir, agentSlug }`, loads the space itself and mounts
 * `@deepseek-ai/dsh-persona` with the resulting text — no external script
 * needs to pre-render `charter.md`+`instruct.md` into YAML first, unlike the
 * Phase 1 shape this replaces. `dsh-persona` is scope-only (mounting it
 * outside an agent scope collides with `dsh-system-prompt`'s own unscoped
 * registration) — this plugin must itself be mounted inside an agent-scoped
 * composition (the umbrella `@lmthing/dsh-space` plugin, one mount per
 * agent), same requirement Phase 1 already satisfied.
 *
 * config: { spaceDir: string, agentSlug: string }
 */
export const name = 'lmthing-space-persona'

export async function apply(ctx, config) {
  const text = await resolvePersonaText(config.spaceDir, config.agentSlug)
  const persona = await import('@deepseek-ai/dsh-persona')
  await ctx.plugin(persona.default ?? persona, { text })
}

export { resolvePersonaText, buildPersonaText } from './resolve.js'
