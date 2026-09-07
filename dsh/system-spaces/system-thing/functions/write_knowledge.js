import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

const userSpacesRoot = () => process.env['LMTHING_USER_SPACES_ROOT'] ?? join(process.cwd(), '.lmthing-user-spaces')

const SLUG_RE = /^[a-z][a-z0-9-]{0,63}$/

function safeJoin(root, ...segments) {
  const resolvedRoot = resolve(root)
  const target = resolve(resolvedRoot, ...segments)
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + sep)) {
    throw new Error('refused: path would escape the spaces root')
  }
  return target
}

export const description =
  'Add a knowledge domain to an agent previously created with create_agent: writes ' +
  'knowledge/<topic>/index.md under its space AND registers the topic in that agent\'s own ' +
  'instruct.md frontmatter (knowledge: [...]), so it is actually loadable — a knowledge file with ' +
  'no agent referencing it does nothing. Upserts both. The target agent must already exist.'

export const schema = {
  spaceSlug: { type: 'string', required: true, description: 'The space\'s slug, as passed to create_agent.' },
  agentSlug: { type: 'string', required: true, description: 'The agent within that space to register this topic on, as passed to create_agent.' },
  topic: { type: 'string', required: true, description: 'Short kebab-case topic slug, e.g. "opening-hours".' },
  markdown: { type: 'string', required: true, description: 'The knowledge content, plain markdown, no frontmatter.' },
}

export const outputSchema = {
  type: 'object',
  properties: { ok: { type: 'boolean', required: true }, error: { type: 'string' }, path: { type: 'string' } },
  additionalProperties: false,
}

/** Registers `topic` in an instruct.md's flow-style `knowledge: [a, b]` frontmatter line, deduped.
 *  A regex, not a real YAML parse — safe only because create_agent guarantees this exact one-line
 *  flow-list shape exists on every agent this function is allowed to target. */
function registerKnowledgeTopic(instructPath, topic) {
  const text = readFileSync(instructPath, 'utf8')
  const match = text.match(/^knowledge:\s*\[([^\]]*)\]\s*$/m)
  if (!match) throw new Error(`${instructPath} has no "knowledge: [...]" frontmatter line to extend`)
  const existing = match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (existing.includes(topic)) return
  const updatedLine = `knowledge: [${[...existing, topic].join(', ')}]`
  writeFileSync(instructPath, text.replace(match[0], updatedLine), 'utf8')
}

/** @param {{ spaceSlug: string, agentSlug: string, topic: string, markdown: string }} args */
export function write_knowledge(args) {
  try {
    if (!SLUG_RE.test(args.spaceSlug)) return { ok: false, error: 'spaceSlug must be lowercase kebab-case (a-z0-9-), starting with a letter' }
    if (!SLUG_RE.test(args.agentSlug)) return { ok: false, error: 'agentSlug must be lowercase kebab-case (a-z0-9-), starting with a letter' }
    if (!SLUG_RE.test(args.topic)) return { ok: false, error: 'topic must be lowercase kebab-case (a-z0-9-), starting with a letter' }

    const root = userSpacesRoot()
    const spaceDir = safeJoin(root, args.spaceSlug)
    const instructPath = safeJoin(spaceDir, 'agents', args.agentSlug, 'instruct.md')
    if (!existsSync(instructPath)) {
      return { ok: false, error: `no agent "${args.agentSlug}" in space "${args.spaceSlug}" — create it with create_agent first` }
    }

    const topicDir = safeJoin(spaceDir, 'knowledge', args.topic)
    mkdirSync(topicDir, { recursive: true })
    const path = join(topicDir, 'index.md')
    writeFileSync(path, args.markdown.trimEnd() + '\n', 'utf8')
    registerKnowledgeTopic(instructPath, args.topic)

    return { ok: true, path }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
