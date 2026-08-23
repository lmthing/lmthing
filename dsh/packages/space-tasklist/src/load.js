import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import ts from 'typescript'
import { parseFrontmatter, CAPABILITY_IDS } from '@lmthing/dsh-space-format'

/**
 * Ported from sdk/org/libs/core/src/spaces/tasklist-load.ts. This loader is
 * intentionally PERMISSIVE and faithful to the original — it parses every
 * field LMThing's format supports, including the ones `compile.js` cannot
 * honor when targeting dsh-workflow (onFail, capabilities, functions,
 * canDelegateTo, prelude, checkpoint nodes). Rejecting those belongs to the
 * COMPILE step (a dsh-workflow-specific limitation), not the load step (a
 * faithful parse of the on-disk format) — a future host that isn't
 * dsh-workflow could still use this loader's full output.
 *
 * @typedef {Object} TaskNode
 * @property {string} id
 * @property {'agent'|'code'|'subgraph'|'checkpoint'} kind
 * @property {string} [codeModulePath]
 * @property {string} [subgraph]
 * @property {string} instruction
 * @property {Record<string,string>} output
 * @property {Record<string,string>} [input]
 * @property {string[]} [dependsOn]
 * @property {string} [condition]
 * @property {boolean} [optional]
 * @property {boolean} [goal]
 * @property {'explore'|'plan'|'general'} [role]
 * @property {string} [model]
 * @property {string[]} [functions]
 * @property {string} [forEach]
 * @property {string[]} [canDelegateTo]
 * @property {string[]} [capabilities]
 * @property {string} [prelude]
 * @property {{ goto: string, when?: string, carry?: string, maxAttempts?: number }} [onFail]
 */

/**
 * @param {string} dir
 * @param {string[]} files
 * @returns {Promise<Record<string, TaskNode>>}
 */
export async function loadTasklist(dir, files) {
  const tasks = {}

  for (const filePath of files) {
    let task
    if (filePath.endsWith('.ts')) {
      const raw = await readFile(filePath, 'utf8')
      const { node, hasRun } = extractCodeNodeMeta(raw, filePath)
      if (!hasRun) {
        throw new Error(`Code node "${filePath}" must export an async \`run(ctx, inputs)\` function`)
      }
      const filename = basename(filePath, '.ts')
      task = buildTaskNode(node, {
        filename,
        filePath,
        kind: 'code',
        instruction: '',
        codeModulePath: resolve(filePath),
      })
    } else {
      const raw = await readFile(filePath, 'utf8')
      const { data, body } = parseFrontmatter(raw, filePath)
      const filename = basename(filePath, '.md')
      task = buildTaskNode(data, { filename, filePath, kind: 'agent', instruction: body.trim() })
    }
    tasks[task.id] = task
  }

  return tasks
}

function buildTaskNode(data, opts) {
  const { filename, filePath, kind, instruction, codeModulePath } = opts

  const id = data['id'] ? String(data['id']) : filename.replace(/^\d+[-_]?/, '') || filename

  const output = {}
  if (data['output'] && typeof data['output'] === 'object' && !Array.isArray(data['output'])) {
    for (const [k, v] of Object.entries(data['output'])) output[k] = String(v)
  }

  const task = { id, kind, instruction, output }
  if (codeModulePath) task.codeModulePath = codeModulePath

  if (kind !== 'code') {
    const hasSubgraph = data['subgraph'] !== undefined
    const hasCheckpoint = data['checkpoint'] !== undefined
    if (hasSubgraph && hasCheckpoint) {
      throw new Error(`Task "${id}" (${filePath}): a node is either a "subgraph" or a "checkpoint", not both`)
    }
    if (hasSubgraph) {
      if (typeof data['subgraph'] !== 'string' || !data['subgraph'].trim()) {
        throw new Error(`Task "${id}" (${filePath}): "subgraph" must name the sub-tasklist to run (a non-empty string)`)
      }
      task.kind = 'subgraph'
      task.subgraph = data['subgraph'].trim()
    } else if (hasCheckpoint) {
      if (data['checkpoint'] !== true) {
        throw new Error(`Task "${id}" (${filePath}): "checkpoint" is a marker — set it to \`true\` or omit it`)
      }
      task.kind = 'checkpoint'
    }
  }

  if (data['input'] && typeof data['input'] === 'object' && !Array.isArray(data['input'])) {
    const input = {}
    for (const [k, v] of Object.entries(data['input'])) input[k] = String(v)
    task.input = input
  }

  if (Array.isArray(data['dependsOn'])) task.dependsOn = data['dependsOn'].map(String)
  if (typeof data['condition'] === 'string') task.condition = data['condition']
  if (data['optional'] === true) task.optional = true
  if (data['goal'] === true) task.goal = true
  if (data['role'] === 'explore' || data['role'] === 'plan' || data['role'] === 'general') task.role = data['role']

  if (data['model'] !== undefined) {
    if (typeof data['model'] !== 'string' || !data['model'].trim()) {
      throw new Error(`Task "${id}" (${filePath}): "model" must be a non-empty string (a model alias or a "provider:modelId" spec)`)
    }
    task.model = data['model'].trim()
  }
  if (Array.isArray(data['functions'])) task.functions = data['functions'].map(String)
  if (typeof data['forEach'] === 'string' && data['forEach'].trim()) task.forEach = data['forEach'].trim()
  if (Array.isArray(data['canDelegateTo'])) task.canDelegateTo = data['canDelegateTo'].map(String)

  if (data['capabilities'] !== undefined) {
    if (!Array.isArray(data['capabilities'])) {
      throw new Error(`Task "${id}" (${filePath}): "capabilities" must be a list of bare capability ids (a per-node subset of the agent's grants)`)
    }
    const ids = data['capabilities'].map(String)
    const unknown = ids.filter((c) => !CAPABILITY_IDS.has(c))
    if (unknown.length > 0) {
      throw new Error(`Task "${id}" (${filePath}): unknown capability id(s) in "capabilities": ${unknown.join(', ')}. Known: ${[...CAPABILITY_IDS].join(', ')}`)
    }
    task.capabilities = ids
  }

  if (data['prelude'] !== undefined) {
    if (typeof data['prelude'] !== 'string' || !data['prelude'].trim()) {
      throw new Error(`Task "${id}" (${filePath}): "prelude" must be a non-empty string of TypeScript statements`)
    }
    task.prelude = data['prelude']
  }

  if (data['onFail'] !== undefined) {
    const raw = data['onFail']
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error(`Task "${id}" (${filePath}): "onFail" must be a block with a "goto" task id (plus optional when/carry/maxAttempts)`)
    }
    const cfg = raw
    const goto = cfg['goto']
    if (typeof goto !== 'string' || !goto.trim()) {
      throw new Error(`Task "${id}" (${filePath}): "onFail.goto" must name the task id to resume from`)
    }
    const onFail = { goto: goto.trim() }
    if (cfg['when'] !== undefined) {
      if (typeof cfg['when'] !== 'string' || !cfg['when'].trim()) {
        throw new Error(`Task "${id}" (${filePath}): "onFail.when" must be a condition expression`)
      }
      onFail.when = cfg['when'].trim()
    }
    if (cfg['carry'] !== undefined) {
      if (typeof cfg['carry'] !== 'string' || !cfg['carry'].trim()) {
        throw new Error(`Task "${id}" (${filePath}): "onFail.carry" must name a field of this task's output`)
      }
      onFail.carry = cfg['carry'].trim()
    }
    if (cfg['maxAttempts'] !== undefined) {
      const n = Number(cfg['maxAttempts'])
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`Task "${id}" (${filePath}): "onFail.maxAttempts" must be a positive integer`)
      }
      onFail.maxAttempts = n
    }
    task.onFail = onFail
  }

  return task
}

/**
 * Statically extract a code node's `node` metadata object (never imports or
 * executes the module — see the doc comment on the original in
 * sdk/org/libs/core/src/spaces/tasklist-load.ts for the full reasoning; it
 * applies unchanged here even though this port's `space-tasklist/compile.js`
 * ultimately refuses to compile `kind: 'code'` nodes at all, since a dsh
 * workflow script has no filesystem/Node API to run one faithfully).
 * @param {string} source
 * @param {string} filePath
 * @returns {{ node: Record<string, unknown>, hasRun: boolean }}
 */
export function extractCodeNodeMeta(source, filePath) {
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)
  let nodeObj
  let hasRun = false

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === 'run') {
      hasRun = true
      continue
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
        if (decl.name.text === 'node') {
          if (!ts.isObjectLiteralExpression(decl.initializer)) {
            throw new Error(`Code node "${filePath}": exported \`node\` must be an object literal`)
          }
          nodeObj = literalToValue(decl.initializer, filePath)
        } else if (
          decl.name.text === 'run' &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          hasRun = true
        }
      }
    }
  }

  return { node: nodeObj ?? {}, hasRun }
}

function literalToValue(node, filePath) {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((el) => literalToValue(el, filePath))
  if (ts.isObjectLiteralExpression(node)) {
    const obj = {}
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        throw new Error(`Code node "${filePath}": \`node\` metadata must use plain \`key: value\` properties`)
      }
      let key
      if (ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name)) key = prop.name.text
      else throw new Error(`Code node "${filePath}": unsupported \`node\` metadata key`)
      obj[key] = literalToValue(prop.initializer, filePath)
    }
    return obj
  }
  throw new Error(`Code node "${filePath}": \`node\` metadata values must be static literals (found ${ts.SyntaxKind[node.kind]})`)
}

/**
 * @param {import('@lmthing/dsh-space-format').Space} space
 * @param {string} name
 * @returns {Promise<Record<string, TaskNode>>}
 */
export async function loadTasklistFromSpace(space, name) {
  const tasklistDir = space.tasklists[name]
  if (!tasklistDir) {
    throw new Error(`Tasklist "${name}" not found in space at "${space.dir}"`)
  }
  return loadTasklist(tasklistDir.slug, tasklistDir.files)
}
