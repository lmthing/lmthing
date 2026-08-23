import { parse as parseYaml } from 'yaml'

/**
 * Parse YAML frontmatter from a markdown file. Frontmatter is delimited by
 * `---` on its own line. Throws on malformed YAML (rather than silently
 * producing empty data) so an author gets a loud error instead of a
 * mysteriously default-configured agent. `source` is an optional file path
 * included in the error message for context.
 *
 * Ported verbatim from sdk/org/libs/core/src/spaces/frontmatter.ts.
 *
 * @param {string} raw
 * @param {string} [source]
 * @returns {{ data: Record<string, unknown>, body: string }}
 */
export function parseFrontmatter(raw, source) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { data: {}, body: raw }
  }

  const yamlText = match[1]
  const body = match[2].trim()

  let parsed
  try {
    parsed = parseYaml(yamlText)
  } catch (e) {
    const where = source ? ` in ${source}` : ''
    throw new Error(`Invalid YAML frontmatter${where}: ${e instanceof Error ? e.message : String(e)}`)
  }

  let data = {}
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    data = parsed
  }

  return { data, body }
}
