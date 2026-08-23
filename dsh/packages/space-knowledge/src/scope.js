import { resolveKnowledge } from './resolve.js'

/**
 * Split a `knowledge:` frontmatter ref ("domain", "domain/field",
 * "domain/field/option") into its segments, dropping empties so a stray
 * leading/trailing/doubled slash can't produce a phantom segment.
 * @param {string} ref
 * @returns {string[]}
 */
function refSegments(ref) {
  return String(ref).split('/').filter((segment) => segment.length > 0)
}

/**
 * Is `path` inside the allowlist `refs`?
 *
 * A ref allows every path it is a PREFIX of, and nothing else:
 *
 *   refs ['product']              allows ['product'], ['product','tier'], ['product','tier','pro']
 *   refs ['billing/pricingTier']  allows ['billing','pricingTier'] and its options,
 *                                 but NOT ['billing'] (that would reveal sibling fields)
 *                                 and NOT ['billing','refundPolicy']
 *
 * The empty path (`resolveKnowledge`'s all-domains overview) is allowed by NO
 * non-empty ref: the unscoped overview lists every domain in the space,
 * including undeclared ones, so it is not something a scoped caller may ask
 * for. Discovery is served ambiently instead, by ./tree.js's rendered section.
 *
 * @param {string[]} path the requested [domain, field?, option?]
 * @param {string[]} refs the agent's `agent.config.knowledge`
 * @returns {boolean}
 */
export function isPathAllowed(path, refs) {
  if (!Array.isArray(refs) || refs.length === 0) return false
  const requested = (path ?? []).filter((segment) => typeof segment === 'string' && segment.length > 0)
  if (requested.length === 0) return false

  return refs.some((ref) => {
    const allowed = refSegments(ref)
    if (allowed.length === 0 || allowed.length > requested.length) return false
    return allowed.every((segment, i) => segment === requested[i])
  })
}

/**
 * `resolveKnowledge` + the access check the original doesn't need (see
 * ./resolve.js's doc comment, divergence 2). Fail-loud on an out-of-scope
 * path — the same philosophy as `space-format`'s
 * `AGENT_FRONTMATTER_ALLOWED_KEYS` gate — rather than silently returning
 * nothing, which would read to the model as "this knowledge is empty".
 *
 * @param {{ knowledge: { domains: Record<string, any> } }} space
 * @param {string[]} path
 * @param {string[]} refs
 * @returns {Promise<unknown>}
 */
export async function resolveKnowledgeScoped(space, path, refs) {
  if (!isPathAllowed(path, refs)) {
    const requested = (path ?? []).filter((segment) => typeof segment === 'string' && segment.length > 0).join('/')
    const declared = (refs ?? []).map((ref) => `'${ref}'`).join(', ')
    throw new Error(
      `knowledge path '${requested}' is not declared in this agent's knowledge: [${declared}]`,
    )
  }
  return await resolveKnowledge(space, path)
}
