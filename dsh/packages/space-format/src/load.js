import { readFile, readdir, stat } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { parseFrontmatter } from './frontmatter.js'
import { parseCapabilities } from './capabilities.js'

/**
 * Ported from sdk/org/libs/core/src/spaces/load.ts, with two Phase-1
 * simplifications noted in the plan (dsh/packages/README.md):
 *
 *  - No esbuild function bundling. The original bundles a space's
 *    functions/*.ts for a BROWSER sandbox (LMThing's QuickJS VM). dsh tools
 *    run server-side as plain Node, so `space-functions` (the plugin that
 *    registers them as tools) can execute the original TS source directly —
 *    no browser bundle is needed.
 *  - No dependent-space auto-`npm install`. A space's package.json is still
 *    read for its own `name`, but installing/recursing into npm-dependency
 *    spaces (LMThing's `dependentSpaces`) is deferred — none of Phase 1's
 *    ported content (system-global, trimmed user-thing, one toy specialist)
 *    declares any, and the recursive-install behavior needs its own review
 *    before this port relies on it.
 *
 * Everything else — frontmatter validation, the fail-loud allow-lists, the
 * canDelegateTo tri-state, cross-reference validation — is unchanged.
 */

async function dirExists(path) {
  try {
    const s = await stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

async function fileExists(path) {
  try {
    const s = await stat(path)
    return s.isFile()
  } catch {
    return false
  }
}

async function listDir(dir) {
  try {
    return await readdir(dir)
  } catch {
    return []
  }
}

/**
 * Extensions loaded from a space's `functions/` dir. LMThing's original only
 * recognizes `.ts`/`.tsx` (its functions run inside a TS-only QuickJS VM).
 * This port's functions run as real Node ESM (space-functions plugin
 * dynamically `import()`s them), so `.js`/`.mjs` are
 * equally legitimate here — a deliberate, documented widening for the dsh
 * port, not a LMThing behavior change (see dsh/packages/README.md).
 */
const FUNCTION_FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs']

/**
 * Load the `functions/` directory under `dir`. Returns the original source
 * for every recognized file, keyed by basename.
 * @param {string} dir
 * @returns {Promise<Record<string, string>>}
 */
export async function loadFunctionsFromDir(dir) {
  const functionsDir = join(dir, 'functions')
  if (!(await dirExists(functionsDir))) return {}

  const files = await listDir(functionsDir)
  const functions = {}
  for (const file of files) {
    if (FUNCTION_FILE_EXTENSIONS.some((ext) => file.endsWith(ext))) {
      const name = basename(file, extname(file))
      functions[name] = await readFile(join(functionsDir, file), 'utf8')
    }
  }
  return functions
}

async function loadComponents(dir) {
  const componentsDir = join(dir, 'components')
  const view = {}
  const form = {}
  if (!(await dirExists(componentsDir))) return { view, form }

  const viewDir = join(componentsDir, 'view')
  if (await dirExists(viewDir)) {
    for (const file of await listDir(viewDir)) {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        view[basename(file, extname(file))] = await readFile(join(viewDir, file), 'utf8')
      }
    }
  }

  const formDir = join(componentsDir, 'form')
  if (await dirExists(formDir)) {
    for (const entry of await listDir(formDir)) {
      const entryPath = join(formDir, entry)
      if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        form[basename(entry, extname(entry))] = await readFile(entryPath, 'utf8')
      }
    }
  }

  return { view, form }
}

/** Allowed frontmatter keys for a knowledge option file (knowledge/<domain>/<field>/<slug>.md). */
const KNOWLEDGE_OPTION_ALLOWED_KEYS = new Set(['description', 'icon', 'color', 'label'])

/**
 * Validate a knowledge option file's frontmatter against the spec allow-list.
 * Returns the validated `description` (undefined for a plain-markdown option).
 * @param {string} raw
 * @param {string} source
 * @returns {string | undefined}
 */
export function validateKnowledgeOptionFrontmatter(raw, source) {
  const { data } = parseFrontmatter(raw, source)
  if (Object.keys(data).length === 0) return undefined

  if (typeof data['description'] !== 'string' || data['description'].length === 0) {
    throw new Error(`Knowledge option "${source}" has frontmatter but is missing required key "description"`)
  }

  const unknownKeys = Object.keys(data).filter((k) => !KNOWLEDGE_OPTION_ALLOWED_KEYS.has(k))
  if (unknownKeys.length > 0) {
    throw new Error(`Knowledge option "${source}" has disallowed frontmatter key(s): ${unknownKeys.join(', ')}. Allowed keys: description (required), icon, color, label`)
  }
  return data['description']
}

async function loadKnowledge(dir) {
  const knowledgeDir = join(dir, 'knowledge')
  const domains = {}
  if (!(await dirExists(knowledgeDir))) return { domains }

  for (const domainSlug of await listDir(knowledgeDir)) {
    const domainDir = join(knowledgeDir, domainSlug)
    if (!(await dirExists(domainDir))) continue

    const fields = {}
    for (const fieldSlug of await listDir(domainDir)) {
      const fieldDir = join(domainDir, fieldSlug)
      if (!(await dirExists(fieldDir))) continue

      let type = 'string'
      let variableName = fieldSlug
      let defaultValue
      let fieldDescription

      const metaPath = join(fieldDir, 'index.md')
      if (await fileExists(metaPath)) {
        const raw = await readFile(metaPath, 'utf8')
        const { data, body } = parseFrontmatter(raw, metaPath)
        if (typeof data['type'] === 'string') type = data['type']
        if (typeof data['variable'] === 'string') variableName = data['variable']
        if ('default' in data) defaultValue = data['default']
        if (body && body.trim()) fieldDescription = body.trim()
      }

      const options = {}
      const optionDescriptions = {}
      for (const optFile of await listDir(fieldDir)) {
        if (!optFile.endsWith('.md') || optFile === 'index.md') continue
        const optionSlug = basename(optFile, '.md')
        const optionPath = join(fieldDir, optFile)
        const desc = validateKnowledgeOptionFrontmatter(await readFile(optionPath, 'utf8'), optionPath)
        options[optionSlug] = optionPath
        if (desc) optionDescriptions[optionSlug] = desc
      }

      const field = { slug: fieldSlug, type, variableName, options, optionDescriptions }
      if (defaultValue !== undefined) field.default = defaultValue
      if (fieldDescription) field.description = fieldDescription
      fields[fieldSlug] = field
    }

    const domain = { slug: domainSlug, fields }
    const domainIndexPath = join(domainDir, 'index.md')
    if (await fileExists(domainIndexPath)) {
      const { body } = parseFrontmatter(await readFile(domainIndexPath, 'utf8'), domainIndexPath)
      if (body) domain.description = body
    }
    domains[domainSlug] = domain
  }

  return { domains }
}

async function loadTasklists(dir) {
  const tasklistsDir = join(dir, 'tasklists')
  const result = {}
  if (!(await dirExists(tasklistsDir))) return result

  for (const slug of await listDir(tasklistsDir)) {
    const tlDir = join(tasklistsDir, slug)
    if (!(await dirExists(tlDir))) continue

    const files = await listDir(tlDir)
    const nodeFiles = files
      .filter((f) => (f.endsWith('.md') && f !== 'index.md') || (f.endsWith('.ts') && !f.endsWith('.d.ts')))
      .sort()
      .map((f) => join(tlDir, f))

    const tasklist = { slug, files: nodeFiles }

    const indexPath = join(tlDir, 'index.md')
    if (await fileExists(indexPath)) {
      const raw = await readFile(indexPath, 'utf8')
      const { data, body } = parseFrontmatter(raw, indexPath)
      if (body) tasklist.description = body
      if (data['input'] && typeof data['input'] === 'object' && !Array.isArray(data['input'])) {
        const input = {}
        for (const [k, v] of Object.entries(data['input'])) input[k] = String(v)
        tasklist.input = input
      }
      if (Array.isArray(data['connections'])) tasklist.connections = data['connections'].map(String)
    }

    result[slug] = tasklist
  }

  return result
}

/**
 * Allowed top-level keys in an agent `instruct.md` frontmatter block.
 * Fail-loud gate: a key outside this set is an authoring error — most
 * importantly a typo'd `capabilities`/`canDelegateTo` would otherwise be
 * silently ignored, granting nothing. Kept in lockstep with every key
 * `loadAgent` reads below.
 */
const AGENT_FRONTMATTER_ALLOWED_KEYS = new Set([
  'title',
  'knowledge',
  'functions',
  'components',
  'actions',
  'defaultAction',
  'canDelegateTo',
  'dependencies',
  'capabilities',
  'model',
  'triggers',
])

/** URL-safe webhook path pattern. */
const WEBHOOK_PATH_RE = /^[A-Za-z0-9_-]+$/

async function loadAgent(agentsDir, slug, onWarn, knownTables) {
  const agentDir = join(agentsDir, slug)

  const instructPath = join(agentDir, 'instruct.md')
  let instructBody = ''
  let charterBody = ''
  let title = slug
  const actions = []
  const config = { knowledge: [], functions: [], components: [] }
  // Omitted vs empty is SEMANTIC: keep undefined when the key is absent so a
  // downstream delegate-policy evaluator can apply the level default.
  let canDelegateTo
  let defaultAction
  let model
  let capabilities = {}
  let triggers

  if (await fileExists(instructPath)) {
    const raw = await readFile(instructPath, 'utf8')
    const { data, body } = parseFrontmatter(raw, instructPath)
    instructBody = body

    const unknownKeys = Object.keys(data).filter((k) => !AGENT_FRONTMATTER_ALLOWED_KEYS.has(k))
    if (unknownKeys.length > 0) {
      throw new Error(`Agent "${slug}" (${instructPath}) has disallowed frontmatter key(s): ${unknownKeys.join(', ')}. Allowed keys: ${[...AGENT_FRONTMATTER_ALLOWED_KEYS].join(', ')}`)
    }

    capabilities = parseCapabilities(data['capabilities'], { agentId: slug, knownTables })

    if (typeof data['title'] === 'string') title = data['title']
    if (typeof data['defaultAction'] === 'string') defaultAction = data['defaultAction']
    if (typeof data['model'] === 'string' && data['model'].trim()) model = data['model'].trim()
    if (Array.isArray(data['knowledge'])) config.knowledge = data['knowledge'].map(String)
    if (Array.isArray(data['functions'])) config.functions = data['functions'].map(String)
    if (Array.isArray(data['components'])) config.components = data['components'].map(String)
    if (Array.isArray(data['canDelegateTo'])) {
      canDelegateTo = data['canDelegateTo'].map(String)
    } else if (Array.isArray(data['dependencies'])) {
      canDelegateTo = data['dependencies'].map(String)
    }

    const instructProse = instructBody.replace(/```[\s\S]*?```/g, '')
    if (canDelegateTo && canDelegateTo.length === 0 && instructProse.includes('delegate(')) {
      onWarn(
        `agent "${slug}" (${instructPath}): canDelegateTo: [] means no delegation, but the instruct body calls delegate() — use ["*"] or an explicit allowlist if this agent should delegate`,
      )
    }

    if (Array.isArray(data['actions'])) {
      for (const action of data['actions']) {
        if (typeof action === 'object' && action !== null) {
          actions.push({
            id: String(action['id'] ?? ''),
            label: String(action['label'] ?? ''),
            description: String(action['description'] ?? ''),
            tasklist: String(action['tasklist'] ?? ''),
          })
        }
      }
    }

    if (data['triggers'] !== undefined) {
      if (!Array.isArray(data['triggers'])) {
        throw new Error(`Agent "${slug}" (${instructPath}) has a "triggers" frontmatter key that is not an array`)
      }
      triggers = data['triggers'].map((entry) => {
        if (typeof entry !== 'object' || entry === null) {
          throw new Error(`Agent "${slug}" (${instructPath}) has a malformed "triggers" entry: expected an object with a "webhook" key`)
        }
        const webhook = entry['webhook']
        if (typeof webhook !== 'object' || webhook === null) {
          throw new Error(`Agent "${slug}" (${instructPath}) has a malformed "triggers" entry: expected \`webhook: { path, provider? }\``)
        }
        if (typeof webhook['path'] !== 'string' || webhook['path'].length === 0) {
          throw new Error(`Agent "${slug}" (${instructPath}) has a "triggers" entry with a missing or empty webhook.path`)
        }
        if (!WEBHOOK_PATH_RE.test(webhook['path'])) {
          throw new Error(`Agent "${slug}" (${instructPath}) has a "triggers" entry with an invalid webhook.path "${webhook['path']}" (expected URL-safe: letters, digits, '_', '-')`)
        }
        if (webhook['provider'] !== undefined && typeof webhook['provider'] !== 'string') {
          throw new Error(`Agent "${slug}" (${instructPath}) has a "triggers" entry with a non-string webhook.provider`)
        }
        return { path: webhook['path'], ...(typeof webhook['provider'] === 'string' ? { provider: webhook['provider'] } : {}) }
      })
    }
  }

  const charterPath = join(agentDir, 'charter.md')
  if (await fileExists(charterPath)) {
    const raw = await readFile(charterPath, 'utf8')
    const { body } = parseFrontmatter(raw, charterPath)
    charterBody = body.trim()
  }

  return {
    slug,
    title,
    instructBody,
    charterBody,
    actions,
    canDelegateTo,
    config,
    defaultAction,
    capabilities,
    ...(model ? { model } : {}),
    ...(triggers ? { triggers } : {}),
  }
}

/**
 * Load a space directory into an in-memory `Space` record. Fail-loud,
 * synchronous validation graph: every cross-reference (`functions:`,
 * `components:`, `knowledge:`, `actions[].tasklist`) is resolved and checked
 * once, against the sibling directories of the same space.
 *
 * @param {string} dir
 * @param {{ requireAgents?: boolean, onWarn?: (message: string) => void, knownTables?: string[] }} [opts]
 */
export async function loadSpace(dir, opts = {}) {
  const requireAgents = opts.requireAgents ?? true
  const onWarn = opts.onWarn ?? ((message) => console.warn(`[space-format] ${message}`))
  const agentsDir = join(dir, 'agents')
  const hasAgentsDir = await dirExists(agentsDir)

  if (!hasAgentsDir && requireAgents) {
    throw new Error(`Space at "${dir}" must have an agents/ directory`)
  }

  const agentSlugs = hasAgentsDir ? await listDir(agentsDir) : []
  const agentDirs = []
  for (const slug of agentSlugs) {
    if (await dirExists(join(agentsDir, slug))) agentDirs.push(slug)
  }

  if (agentDirs.length === 0 && requireAgents) {
    throw new Error(`Space at "${dir}" must have at least one agent`)
  }

  let packageName
  const pkgJsonPath = join(dir, 'package.json')
  if (await fileExists(pkgJsonPath)) {
    const pkgData = JSON.parse(await readFile(pkgJsonPath, 'utf8'))
    if (typeof pkgData['name'] === 'string') packageName = pkgData['name']
    // Dependent-space npm-install/recursion deferred — see module doc comment.
  }

  const agents = {}
  for (const slug of agentDirs) {
    agents[slug] = await loadAgent(agentsDir, slug, onWarn, opts.knownTables)
  }

  const tasklists = await loadTasklists(dir)

  for (const agent of Object.values(agents)) {
    for (const action of agent.actions) {
      if (action.tasklist && !(action.tasklist in tasklists)) {
        throw new Error(`Agent "${agent.slug}" action "${action.id}" references tasklist "${action.tasklist}" which does not exist`)
      }
    }
  }

  const functions = await loadFunctionsFromDir(dir)
  const components = await loadComponents(dir)
  const knowledge = await loadKnowledge(dir)

  for (const agent of Object.values(agents)) {
    for (const fnName of agent.config.functions) {
      if (!(fnName in functions)) {
        throw new Error(`Agent "${agent.slug}" requires function "${fnName}" but it was not found in functions/`)
      }
    }
    for (const compName of agent.config.components) {
      if (!(compName in components.view) && !(compName in components.form)) {
        throw new Error(`Agent "${agent.slug}" requires component "${compName}" but it was not found in components/view or components/form`)
      }
    }
    for (const knowledgeRef of agent.config.knowledge) {
      const [domainSlug, fieldSlug, optionSlug] = knowledgeRef.split('/')
      const domain = domainSlug ? knowledge.domains[domainSlug] : undefined
      if (!domain) {
        throw new Error(`Agent "${agent.slug}" references knowledge "${knowledgeRef}" but domain "${domainSlug}" was not found in knowledge/`)
      }
      const field = fieldSlug ? domain.fields[fieldSlug] : undefined
      if (fieldSlug && !field) {
        throw new Error(`Agent "${agent.slug}" references knowledge "${knowledgeRef}" but field "${fieldSlug}" was not found in domain "${domainSlug}"`)
      }
      if (optionSlug && field && !(optionSlug in field.options)) {
        throw new Error(`Agent "${agent.slug}" references knowledge "${knowledgeRef}" but option "${optionSlug}" was not found in field "${fieldSlug}" of domain "${domainSlug}"`)
      }
    }
  }

  return { dir, packageName, agents, tasklists, functions, components, knowledge }
}
