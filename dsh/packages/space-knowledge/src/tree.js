import { isPathAllowed } from './scope.js'

/** Longest description snippet rendered per tree line, before truncation. */
const MAX_DESCRIPTION_CHARS = 200

/**
 * Shortest cut a sentence boundary may produce before truncation falls back to
 * a word boundary + ellipsis instead. Guards the one bad case of preferring
 * sentence boundaries: a description opening with an abbreviation ("e.g. …")
 * would otherwise summarize to four characters.
 */
const MIN_SENTENCE_CHARS = 40

/**
 * Condense a knowledge description into ONE tree line.
 *
 * Necessary because `space-format`'s loader (faithfully ported from LMThing)
 * takes a domain's/field's description from the ENTIRE BODY of its `index.md`,
 * not from a short frontmatter field — and in real spaces that body is a full
 * markdown document. `store/spaces/integration-slack`'s single field carries a
 * ~20-line cheat-sheet; `store/projects/blog/spaces/newsroom`'s three fields
 * carry ~25 lines each. Rendering those verbatim would make an "available
 * knowledge" LISTING larger than the knowledge it lists, on every request.
 * (Option descriptions come from a real frontmatter `description:` key and are
 * already one-liners; they go through the same helper for uniformity and as a
 * cap against an over-long one.)
 *
 * Takes the first paragraph, skipping leading markdown headings, collapses it
 * to a single line, and truncates at the last sentence boundary that fits (or
 * the last word) with an ellipsis. Deliberate refinement of the plan's
 * "descriptions render inline".
 *
 * A better one-liner already exists on disk but is NOT reachable from the
 * loaded shape: real field `index.md` files carry a short frontmatter
 * `description:` (e.g. newsroom's "Judging which sources and items are worth
 * polling and citing, and detecting duplicates.") which `space-format`'s
 * loader — faithful to LMThing — reads past, keeping only the body. Carrying
 * that key through `space.knowledge.domains[...].fields[...]` would let this
 * renderer prefer an author-written summary and fall back to this helper; a
 * `space-format` shape change is out of scope here.
 *
 * @param {string | undefined} text
 * @param {number} [max]
 * @returns {string}
 */
export function summarizeDescription(text, max = MAX_DESCRIPTION_CHARS) {
  if (typeof text !== 'string' || text.trim().length === 0) return ''
  const lines = text.split('\n')

  let start = 0
  while (start < lines.length && (lines[start].trim().length === 0 || lines[start].trim().startsWith('#'))) start++
  // A description that is nothing BUT headings still deserves a line: fall
  // back to its first heading with the marker characters stripped.
  if (start >= lines.length) {
    const heading = lines.find((line) => line.trim().length > 0) ?? ''
    return heading.replace(/^#+\s*/, '').trim().slice(0, max)
  }

  const paragraph = []
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim().length === 0) break
    paragraph.push(lines[i].trim())
  }

  const collapsed = paragraph.join(' ').replace(/\s+/g, ' ').trim()
  if (collapsed.length <= max) return collapsed

  const window = collapsed.slice(0, max)
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '))
  if (sentenceEnd >= Math.min(MIN_SENTENCE_CHARS, max / 2)) return window.slice(0, sentenceEnd + 1)
  const wordEnd = window.lastIndexOf(' ')
  return `${(wordEnd > 0 ? window.slice(0, wordEnd) : window).replace(/[,;:]$/, '')}…`
}

/** ` — <description>` when there is one, otherwise nothing. */
function suffix(description) {
  const summary = summarizeDescription(description)
  return summary ? ` — ${summary}` : ''
}

/**
 * Filter `domains` down to exactly what `refs` allows, keeping the loaded
 * insertion order at every level. A domain survives when the domain itself is
 * allowed or anything beneath it is; likewise a field. Purely a projection of
 * the loaded shape — exported for testing and for anything else that needs to
 * know what an agent may actually see.
 *
 * @param {Record<string, any>} domains `space.knowledge.domains`
 * @param {string[]} refs `agent.config.knowledge`
 * @returns {{ slug: string, description?: string, fields: { slug: string, type: string, default?: unknown, description?: string, options: { slug: string, description?: string }[] }[] }[]}
 */
export function scopeKnowledgeTree(domains, refs) {
  if (!domains || !Array.isArray(refs) || refs.length === 0) return []

  const result = []
  for (const [domainSlug, domain] of Object.entries(domains)) {
    const fields = []
    for (const [fieldSlug, field] of Object.entries(domain.fields ?? {})) {
      const options = []
      for (const optionSlug of Object.keys(field.options ?? {})) {
        if (!isPathAllowed([domainSlug, fieldSlug, optionSlug], refs)) continue
        options.push({
          slug: optionSlug,
          ...(field.optionDescriptions?.[optionSlug] ? { description: field.optionDescriptions[optionSlug] } : {}),
        })
      }
      if (options.length === 0 && !isPathAllowed([domainSlug, fieldSlug], refs)) continue
      fields.push({
        slug: fieldSlug,
        type: field.type,
        ...(field.default !== undefined ? { default: field.default } : {}),
        ...(field.description ? { description: field.description } : {}),
        options,
      })
    }
    if (fields.length === 0 && !isPathAllowed([domainSlug], refs)) continue
    result.push({
      slug: domainSlug,
      ...(domain.description ? { description: domain.description } : {}),
      fields,
    })
  }
  return result
}

/**
 * Render the agent-visible slice of a space's knowledge tree as a markdown
 * directory listing for the system prompt — the "ambient tree" half of this
 * plugin's design: the model can SEE what exists without a round trip, and
 * spends a `loadKnowledge` call only to fetch a specific leaf's content.
 *
 * Returns `''` when `refs` is empty or allows nothing; an empty section text is
 * safe — `dsh-system-prompt`'s `renderPrompt` drops empty sections — but the
 * plugin skips registering the section at all in that case anyway.
 *
 * @param {Record<string, any>} domains `space.knowledge.domains`
 * @param {string[]} refs `agent.config.knowledge`
 * @returns {string}
 */
export function renderKnowledgeTree(domains, refs) {
  const scoped = scopeKnowledgeTree(domains, refs)
  if (scoped.length === 0) return ''

  const lines = [
    '## Knowledge available to you',
    '',
    'Reference material for this space, listed as `domain` → `field` → `option`. Only what is listed',
    'here exists for you; fetch one option\'s full content with the `loadKnowledge` tool (a `domain` +',
    '`field` + `option`), and load it when the task actually needs it rather than up front.',
    '',
  ]

  for (const domain of scoped) {
    lines.push(`- **${domain.slug}**${suffix(domain.description)}`)
    for (const field of domain.fields) {
      const annotations = []
      if (field.type && field.type !== 'string') annotations.push(`type: ${field.type}`)
      if (field.default !== undefined) annotations.push(`default: ${String(field.default)}`)
      const annotated = annotations.length > 0 ? ` (${annotations.join(', ')})` : ''
      lines.push(`  - **${field.slug}**${annotated}${suffix(field.description)}`)
      for (const option of field.options) {
        lines.push(`    - ${option.slug}${suffix(option.description)}`)
      }
    }
  }

  return lines.join('\n')
}
