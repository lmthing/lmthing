import { loadSpace } from '@lmthing/dsh-space-format'
import { loadTasklist } from './load.js'
import { compileTasklistToWorkflowScript } from './compile.js'

/**
 * Turn one space + agent into the workflow-tool specs the plugin registers.
 * Pure apart from reading the space off disk — unit-testable without Cordis,
 * matching `space-functions`/`space-delegate`'s shape (their `apply()` is a
 * thin wrapper over exactly this kind of resolver).
 *
 * ## Reachability rule: one tool per ACTION, not per tasklist
 *
 * An agent's `actions[]` (`{id, label, description, tasklist}`) are LMThing's
 * own user-facing entry points into its tasklists; a tasklist without an action
 * is an implementation detail — most often a `subgraph:`-only helper. So a
 * tasklist reachable ONLY through a subgraph reference stays invisible to the
 * model, exactly as authored, and is compiled inline into its parent instead.
 *
 * ## `connections:` is flagged, never silently dropped
 *
 * A tasklist may declare `connections:` (parsed by `space-format`'s
 * `loadTasklists`). In LMThing it gates a `kind: 'code'` node's `ctx`
 * (db/callConnection/delegate) — and code nodes are refused by the compiler
 * outright, so it can have no effect on a compiled script. It is warned about
 * rather than ignored in silence.
 *
 * @param {string} spaceDir
 * @param {string} agentSlug
 * @param {{ onWarn?: (message: string) => void }} [opts]
 * @returns {Promise<{ toolName: string, actionId: string, tasklist: string, description: string, parameters: Record<string, object>, meta: { name: string, description: string }, script: string }[]>}
 */
export async function resolveTasklistTools(spaceDir, agentSlug, opts = {}) {
  const onWarn = opts.onWarn ?? ((message) => console.warn(`[space-tasklist] ${message}`))
  const space = await loadSpace(spaceDir, { onWarn })
  const agent = space.agents[agentSlug]
  if (!agent) {
    throw new Error(`@lmthing/dsh-space-tasklist: agent "${agentSlug}" not found in space at "${spaceDir}"`)
  }

  /** Same-space subgraph resolution only — cross-space subgraph references are out of scope, mirroring space-delegate's Phase 1 scoping of cross-space canDelegateTo. */
  const loaded = new Map()
  const tasklistTasks = async (slug) => {
    if (!loaded.has(slug)) {
      const dir = space.tasklists[slug]
      if (!dir) {
        throw new Error(`@lmthing/dsh-space-tasklist: tasklist "${slug}" not found in space at "${spaceDir}" (this space has: ${Object.keys(space.tasklists).join(', ') || 'none'})`)
      }
      loaded.set(slug, await loadTasklist(dir.slug, dir.files))
    }
    return loaded.get(slug)
  }

  const actions = agent.actions.filter((action) => Boolean(action.tasklist))
  // Every same-space tasklist is pre-loaded up front so `resolveSubgraph` can
  // stay synchronous (the compiler is pure and synchronous by design).
  if (actions.length > 0) {
    for (const slug of Object.keys(space.tasklists)) await tasklistTasks(slug)
  }

  const specs = []
  const seen = new Set()

  for (const action of actions) {
    const tasklistDir = space.tasklists[action.tasklist]
    if (tasklistDir.connections?.length) {
      onWarn(`tasklist "${action.tasklist}" declares connections: [${tasklistDir.connections.join(', ')}], which only gate a code node's ctx in LMThing — code nodes cannot be compiled for dsh-workflow at all, so this declaration has no effect on the generated script`)
    }

    const tasks = await tasklistTasks(action.tasklist)
    const { meta, script } = compileTasklistToWorkflowScript(tasks, {
      name: workflowMetaName(action.tasklist),
      description: metaDescription(action, tasklistDir),
      hasInput: Boolean(tasklistDir.input && Object.keys(tasklistDir.input).length > 0),
      resolveSubgraph: (slug) => {
        const child = loaded.get(slug)
        if (!child) {
          throw new Error(`@lmthing/dsh-space-tasklist: subgraph "${slug}" is not a tasklist of the space at "${spaceDir}" (cross-space subgraph references are out of scope)`)
        }
        return child
      },
    })

    const toolName = actionToolName(action.id, action.tasklist)
    if (seen.has(toolName)) {
      throw new Error(`@lmthing/dsh-space-tasklist: agent "${agentSlug}" produces two actions with the same tool name "${toolName}" — give each action a distinct id`)
    }
    seen.add(toolName)

    specs.push({
      toolName,
      actionId: action.id,
      tasklist: action.tasklist,
      description: toolDescription(action, tasklistDir),
      parameters: parameterSchemaFromInput(tasklistDir.input),
      meta,
      script,
    })
  }

  return specs
}

/** A dsh tool name: the action id, normalized to the conservative `[a-z0-9_]` shape tool names use. */
export function actionToolName(actionId, tasklistSlug) {
  const base = String(actionId || tasklistSlug).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `run_${base || 'tasklist'}`
}

/** `meta.name` must be short kebab-case (the engine validates the meta block before the body runs). */
function workflowMetaName(tasklistSlug) {
  return String(tasklistSlug).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tasklist'
}

function metaDescription(action, tasklistDir) {
  const text = firstLine(action.description) || firstLine(action.label) || firstLine(tasklistDir.description) || `Run the "${action.tasklist}" tasklist.`
  return text
}

function toolDescription(action, tasklistDir) {
  const parts = [action.description, tasklistDir.description].map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean)
  if (parts.length === 0) return `Run the "${action.tasklist}" tasklist (${action.label || action.id}).`
  return parts.join('\n\n')
}

function firstLine(text) {
  if (typeof text !== 'string') return ''
  const line = text.trim().split('\n')[0]?.trim() ?? ''
  return line.length > 160 ? `${line.slice(0, 157)}...` : line
}

/**
 * A tasklist's `input:` type map → a dsh `ParameterSchemaSpec`. LMThing's
 * vocabulary is `string | number | boolean | object | array | any` with a
 * trailing `?` for optional (`sdk/org/libs/core/src/tasklist/schema.ts`), and
 * it is lenient about anything else — so is this, via the author-facing `json`
 * node (unconstrained lossless JSON).
 * @param {Record<string, string> | undefined} input
 */
export function parameterSchemaFromInput(input) {
  const spec = {}
  for (const [field, declared] of Object.entries(input ?? {})) {
    const text = String(declared).trim()
    const optional = text.endsWith('?')
    const base = optional ? text.slice(0, -1) : text
    spec[field] = {
      ...valueSpecForType(base),
      description: `Tasklist input "${field}" (declared ${text}).`,
      ...(optional ? {} : { required: true }),
    }
  }
  return spec
}

function valueSpecForType(base) {
  switch (base) {
    case 'string':
    case 'number':
    case 'boolean':
      return { type: base }
    case 'object':
      // An explicit object node MUST declare its openness (dsh-tools:
      // "Openness is mandatory so a nested or output object never acquires an
      // accidental JSON Schema default").
      return { type: 'object', additionalProperties: true }
    case 'array':
      return { type: 'array' }
    default:
      return { type: 'json' }
  }
}
