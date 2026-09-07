import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

/**
 * Where THING-authored spaces land — a writable root SEPARATE from the shipped, read-only
 * system-thing space this function ships in (LMTHING_SPACE_DIR). On a real pod this is set by
 * @lmthing/dsh-pod-server to a directory on the persistent PVC (/data/spaces); the fallback keeps
 * local/dev runs (run-web.sh, tests) working without it.
 */
const userSpacesRoot = () => process.env['LMTHING_USER_SPACES_ROOT'] ?? join(process.cwd(), '.lmthing-user-spaces')

const SLUG_RE = /^[a-z][a-z0-9-]{0,63}$/

/** Refuses anything that would escape `root` once resolved (defence in depth on top of the slug regex). */
function safeJoin(root, ...segments) {
  const resolvedRoot = resolve(root)
  const target = resolve(resolvedRoot, ...segments)
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + sep)) {
    throw new Error('refused: path would escape the spaces root')
  }
  return target
}

export const description =
  'Create a brand-new dsh agent space: a charter (non-negotiable rules) and instruction body ' +
  '(routing guidance) for a new agent, written to disk under this deployment\'s user-spaces root. ' +
  'Refuses to overwrite an agent that already exists. Takes effect on the NEXT session, not this one.'

export const schema = {
  spaceSlug: { type: 'string', required: true, description: 'Short kebab-case slug for the new space, e.g. "recipe-helper".' },
  agentSlug: { type: 'string', required: true, description: 'Slug of the agent within that space (usually the same as spaceSlug).' },
  charter: { type: 'string', required: true, description: 'The new agent\'s non-negotiable rules (its charter.md body) — plain prose, in the voice of the new agent, not THING.' },
  instructBody: { type: 'string', required: true, description: 'Markdown body for instruct.md — routing/behavioral guidance for the new agent (no frontmatter; this function writes that separately).' },
  title: { type: 'string', description: 'Display title for the agent. Defaults to agentSlug.' },
  canDelegateTo: { type: 'array', items: { type: 'string' }, description: 'Agent slugs this new agent may delegate to. Defaults to none.' },
}
// Deliberately no `functions` field: create_agent never grants a new agent the ability to call
// executable code (this deployment's functions/ files run with plain, unsandboxed Node fs access —
// see system-global/functions/remember.js's own doc comment). A created agent starts with prose
// only (charter + instructions + knowledge, via write_knowledge); wiring real functions onto it is
// a deliberate, reviewed change to the space on disk, not something THING can grant itself or
// another agent through a tool call.

export const outputSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean', required: true },
    error: { type: 'string' },
    spaceDir: { type: 'string' },
    agentSlug: { type: 'string' },
  },
  additionalProperties: false,
}

/**
 * @param {{ spaceSlug: string, agentSlug: string, charter: string, instructBody: string, title?: string, canDelegateTo?: string[] }} args
 */
export function create_agent(args) {
  try {
    if (!SLUG_RE.test(args.spaceSlug)) return { ok: false, error: 'spaceSlug must be lowercase kebab-case (a-z0-9-), starting with a letter' }
    if (!SLUG_RE.test(args.agentSlug)) return { ok: false, error: 'agentSlug must be lowercase kebab-case (a-z0-9-), starting with a letter' }

    const root = userSpacesRoot()
    const spaceDir = safeJoin(root, args.spaceSlug)
    const agentDir = safeJoin(spaceDir, 'agents', args.agentSlug)

    if (existsSync(agentDir)) {
      return { ok: false, error: `an agent already exists at ${args.spaceSlug}/agents/${args.agentSlug} — refusing to overwrite` }
    }

    mkdirSync(agentDir, { recursive: true })

    const title = args.title ?? args.agentSlug
    const canDelegateTo = Array.isArray(args.canDelegateTo) ? args.canDelegateTo : []
    const frontmatter = [
      '---',
      `title: ${title}`,
      `canDelegateTo: [${canDelegateTo.join(', ')}]`,
      // Present (even empty) from creation so write_knowledge can always find and extend this
      // line by regex rather than having to decide whether to insert a brand-new frontmatter key.
      'knowledge: []',
      '---',
    ].join('\n')

    writeFileSync(join(agentDir, 'charter.md'), args.charter.trimEnd() + '\n', 'utf8')
    writeFileSync(join(agentDir, 'instruct.md'), `${frontmatter}\n${args.instructBody.trimEnd()}\n`, 'utf8')

    return { ok: true, spaceDir, agentSlug: args.agentSlug }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
