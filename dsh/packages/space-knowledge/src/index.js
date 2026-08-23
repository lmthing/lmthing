import { defineTool } from '@deepseek-ai/dsh-tools'
import { loadSpace } from '@lmthing/dsh-space-format'
import { renderKnowledgeTree } from './tree.js'
import { resolveKnowledgeScoped } from './scope.js'

/**
 * Self-loading dsh plugin (architecture pivot, see dsh/packages/README.md):
 * given `{ spaceDir, agentSlug }`, loads the space itself and bridges the
 * agent's LMThing `knowledge/` tree onto dsh in two halves:
 *
 *  - AMBIENT: the slice of the tree the agent declares (`knowledge:` in its
 *    `instruct.md` frontmatter) is rendered as a `dsh-system-prompt` SECTION,
 *    so the model can see what knowledge exists without spending a turn
 *    discovering it.
 *  - ON DEMAND: a `loadKnowledge` tool fetches one leaf's full content
 *    (`domain` + `field` + `option`), scoped to the same declared refs.
 *
 * `ctx.systemPrompt.section` was chosen over `ctx.skills` deliberately:
 * `ctx.skills` is built for loadable INSTRUCTIONS rendered as prose at a
 * gesture boundary, while LMThing's `resolveKnowledge` is a typed,
 * path-addressed DATA lookup returning a value. See the plan for the two
 * discarded design passes.
 *
 * One documented fidelity gap against LMThing: there, a THREE-part ref
 * (`domain/field/option`) is PRELOADED — the option body is injected into the
 * system block up front and its siblings hidden — while a two-part ref is
 * surfaced as a menu to fetch from
 * (org/docs/format/space/knowledge/README.md). This plugin treats both the
 * same: it lists what the refs allow (a three-part ref does correctly hide the
 * option's siblings) and every body is fetched through the tool. Preloading a
 * three-part ref's body straight into the section text is a small, additive
 * follow-up, not done here.
 *
 * An agent that declares NO knowledge gets neither the section nor the tool —
 * not even an empty one. A registered `loadKnowledge` with an empty allowlist
 * could only ever answer with an error, which is worse than its absence.
 *
 * `config`:
 *   - `spaceDir`   (required) the space directory to load
 *   - `agentSlug`  (required) whose `knowledge:` refs scope everything
 *   - `toolName`   (optional, default `'loadKnowledge'`) escape hatch for the
 *     one real collision case: `ctx.tools.register` throws on a DUPLICATE NAME
 *     WITHIN ONE LAYER, and `space-delegate`'s established pattern mounts a
 *     delegated target's own feature plugins into the DELEGATOR's scope — so
 *     two agents' knowledge could land in one layer. (The prompt section has
 *     the same constraint and solves it without a knob: its name already
 *     carries `agentSlug`.)
 *
 * Mounted, like every plugin in this family, once per agent:
 *
 *   await ctx.plugin(spaceKnowledge, { spaceDir, agentSlug })
 *
 * `apply()` is async (it `await`s `loadSpace`) — whatever mounts it must
 * `await ctx.plugin(...)`, per this family's hardest-won convention: an
 * unawaited `ctx.plugin()` lets the parent's `apply()` return before an async
 * child registers, and the registration then SILENTLY misses the first
 * request's snapshot with no error anywhere. See `@lmthing/dsh-space`'s doc
 * comment and dsh/packages/README.md. This plugin itself calls no nested
 * `ctx.plugin()`; its own `section`/`register` calls are synchronous and both
 * happen after the single `await` above, before `apply()` returns.
 */
export const name = 'lmthing-space-knowledge'
export const inject = ['systemPrompt', 'tools']

export async function apply(ctx, config) {
  const { spaceDir, agentSlug, toolName = 'loadKnowledge' } = config ?? {}

  const space = await loadSpace(spaceDir)
  const agent = space.agents[agentSlug]
  if (!agent) {
    throw new Error(`@lmthing/dsh-space-knowledge: agent "${agentSlug}" not found in space at "${spaceDir}"`)
  }

  const refs = agent.config.knowledge ?? []
  if (refs.length === 0) return

  const text = renderKnowledgeTree(space.knowledge.domains, refs)
  if (text) {
    // order 10: after dsh-system-prompt's own identity (-100) and the
    // deployment persona (0), ahead of the 100-199 tool-guidance band —
    // dsh-system-prompt's documented order-band convention.
    ctx.systemPrompt.section({ name: `lmthing:knowledge-tree:${agentSlug}`, order: 10, text })
  }

  ctx.tools.register(defineTool({
    name: toolName,
    description: [
      'Load one piece of this space\'s reference knowledge, addressed as domain / field / option.',
      'The "Knowledge available to you" section of your system prompt lists everything you can load;',
      'nothing outside that list is available. Passing only `domain` (or only `domain` + `field`)',
      'returns that level\'s index rather than content, and only works where the whole domain/field is',
      'listed for you.',
    ].join(' '),
    parameters: {
      domain: { type: 'string', required: true, description: 'Knowledge domain slug, e.g. "slack"' },
      field: { type: 'string', description: 'Field slug within the domain, e.g. "api"' },
      option: { type: 'string', description: 'Option slug within the field, e.g. "auth" — the leaf whose content is returned' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [
        { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
      ],
    },
    async execute(args) {
      const path = [args.domain, args.field, args.option].filter((segment) => typeof segment === 'string' && segment.length > 0)
      return await resolveKnowledgeScoped(space, path, refs)
    },
  }))
}

export { resolveKnowledge } from './resolve.js'
export { isPathAllowed, resolveKnowledgeScoped } from './scope.js'
export { renderKnowledgeTree, scopeKnowledgeTree, summarizeDescription } from './tree.js'
