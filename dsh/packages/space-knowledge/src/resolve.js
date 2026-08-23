import { readFile } from 'node:fs/promises'
import { parseFrontmatter, validateKnowledgeOptionFrontmatter } from '@lmthing/dsh-space-format'

/**
 * Ported from sdk/org/libs/core/src/spaces/knowledge.ts#resolveKnowledge,
 * working against the already-loaded `Space` shape `@lmthing/dsh-space-format`
 * produces (`space.knowledge.domains[domain].fields[field].options[option]` is
 * an absolute file path). Same four arities as the original:
 *
 *   []                        -> string[]  every domain slug (overview)
 *   [domain]                  -> { [field]: { type, options: string[] } }
 *   [domain, field]           -> { type, variableName, default?, options: string[] }
 *   [domain, field, option]   -> the option file's frontmatter + body, or its
 *                                raw text when it has no frontmatter
 *
 * TWO deliberate, documented divergences from the original — both forced by
 * dsh's tool contract, neither a behavior change at the JSON level:
 *
 *  1. `undefined` is NEVER a property value in a returned object. The original
 *     returns `default: field.default` (undefined when a field declares no
 *     default) and `body: body || undefined`. dsh's tool registry snapshots a
 *     tool's return value as LOSSLESS JSON, which explicitly rejects
 *     `undefined` — the exact failure mode `system-global`'s `recall` hit in
 *     Phase 2 (`invalid output: value is not lossless JSON`, see
 *     dsh/packages/README.md). So an absent `default`/`body` is an ABSENT KEY
 *     here rather than a present-but-undefined one. `JSON.stringify` erases
 *     that distinction anyway, so nothing observable through the tool changes.
 *  2. Access scoping is enforced OUTSIDE this function, by
 *     `resolveKnowledgeScoped` in ./scope.js. The original needs no such check
 *     because LMThing's DTS/capability lockstep already decided, upstream,
 *     that the calling agent may see a given knowledge ref; this port has no
 *     such lockstep, so the check has to live here. See ./scope.js.
 *
 * @param {{ knowledge: { domains: Record<string, any> } }} space
 * @param {string[]} path
 * @returns {Promise<unknown>}
 */
export async function resolveKnowledge(space, path) {
  const [domainSlug, fieldSlug, optionSlug] = path

  if (!domainSlug) {
    // Overview of all domains.
    return Object.keys(space.knowledge.domains)
  }

  const domain = space.knowledge.domains[domainSlug]
  if (!domain) {
    throw new Error(`Knowledge domain "${domainSlug}" not found`)
  }

  if (!fieldSlug) {
    // Field overview for the domain.
    return Object.fromEntries(
      Object.entries(domain.fields).map(([k, v]) => [k, { type: v.type, options: Object.keys(v.options) }]),
    )
  }

  const field = domain.fields[fieldSlug]
  if (!field) {
    throw new Error(`Knowledge field "${fieldSlug}" not found in domain "${domainSlug}"`)
  }

  if (!optionSlug) {
    // Field metadata. `default` is omitted rather than undefined — see (1) above.
    return {
      type: field.type,
      variableName: field.variableName,
      ...(field.default !== undefined ? { default: field.default } : {}),
      options: Object.keys(field.options),
    }
  }

  const filePath = field.options[optionSlug]
  if (!filePath) {
    throw new Error(
      `Knowledge option "${optionSlug}" not found in field "${fieldSlug}" of domain "${domainSlug}"`,
    )
  }

  const content = await readFile(filePath, 'utf8')
  validateKnowledgeOptionFrontmatter(content, filePath)
  const { data, body } = parseFrontmatter(content, filePath)

  // A frontmattered option returns its structured metadata + body; a plain
  // markdown option returns its raw text. `body` is omitted when empty — see
  // (1) above.
  if (Object.keys(data).length > 0) {
    return { ...data, ...(body ? { body } : {}) }
  }

  return body || content.trim()
}
