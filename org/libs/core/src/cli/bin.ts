#!/usr/bin/env node
import { resolve, dirname, basename } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { parseArgs } from './args'
import { classifyExports, formatExportsForPrompt, importTs, type ClassifiedExport } from './loader'
import {
  Session,
  loadCatalog,
  mergeCatalogs,
  formatCatalogForPrompt,
  buildKnowledgeTree,
  loadKnowledgeFiles,
  formatKnowledgeTreeForPrompt,
  // NOTE: ensureMemoryDomain is not yet exported from @lmthing/repl — needs to be added
  ensureMemoryDomain,
} from '@lmthing/repl'
import { AgentLoop } from './agent-loop'
import { createReplServer } from './server'
import { createKnowledgeNamespace, formatKnowledgeNamespaceForPrompt } from '../agent-namespaces'
import {
  loadAgent,
  resolveLocalFunctions,
  resolveAgentComponents,
  resolveKnowledgeConfig,
  parseFlow,
  formatActionsForPrompt,
  type ParsedFlow,
} from './agent-loader'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env from the package root.
// __dirname is dist/ when compiled, src/cli/ when running from source.
for (const rel of ['../.env', '../../.env']) {
  const envPath = resolve(__dirname, rel)
  if (existsSync(envPath)) { config({ path: envPath }); break }
}

/** Resolve the dist/web directory regardless of whether we're running compiled or from source. */
function resolveDistWeb(): string | undefined {
  for (const rel of ['web', '../../dist/web']) {
    const p = resolve(__dirname, rel)
    if (existsSync(resolve(p, 'index.html'))) return p
  }
  return undefined
}

/** Resolve built-in component paths from component group names. */
function resolveComponentPaths(groups: string[]): string[] {
  const componentsDir = resolve(__dirname, '../components')
  const paths: string[] = []
  for (const group of groups) {
    const indexPath = resolve(componentsDir, group, 'index.ts')
    if (existsSync(indexPath)) {
      paths.push(indexPath)
    }
  }
  return paths
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  // ── Agent mode ──
  if (args.agent) {
    const spacePath = resolve(args.spaces![0])
    const agent = loadAgent(spacePath, args.agent)

    // Resolve model: CLI --model > agent instruct frontmatter > error
    const modelId = args.model ?? agent.model
    if (!modelId) {
      console.error('Error: --model is required (or specify model in agent instruct frontmatter)')
      process.exit(1)
    }

    // Load local functions & classes
    let agentGlobals: Record<string, unknown> = {}
    let agentFnSigs = ''
    let agentFormSigs = ''
    let agentViewSigs = ''
    let agentClassSigs = ''
    let agentClassExports: ClassifiedExport[] = []
    const classConstructors = new Map<string, new () => any>()

    const localFnPaths = resolveLocalFunctions(spacePath, agent.localFunctions)
    for (const fnPath of localFnPaths) {
      let mod: Record<string, unknown> = {}
      try {
        mod = await importTs(fnPath)
        for (const [name, value] of Object.entries(mod)) {
          if (name === 'default') continue
          if (typeof value === 'function') agentGlobals[name] = value
        }
      } catch (err) {
        console.error(`Failed to load function ${fnPath}:`, err)
        continue
      }

      try {
        const exports = classifyExports(fnPath)
        for (const exp of exports) {
          if (exp.kind === 'component' && !exp.form) {
            const fn = agentGlobals[exp.name] as any
            if (fn && fn.form === true) exp.form = true
          }
        }

        const classExports = exports.filter(e => e.kind === 'class')
        agentClassExports.push(...classExports)
        for (const cls of classExports) {
          const ctor = mod[cls.name]
          if (typeof ctor === 'function') classConstructors.set(cls.name, ctor as new () => any)
        }

        const formatted = formatExportsForPrompt(exports, fnPath)
        if (formatted.functions) agentFnSigs += (agentFnSigs ? '\n' : '') + formatted.functions
        if (formatted.classes) agentClassSigs += (agentClassSigs ? '\n' : '') + formatted.classes
      } catch { /* skip */ }
    }

    // Load catalog modules
    let catalogGlobals: Record<string, unknown> = {}
    let catalogSigs = ''
    if (agent.catalogModules.length > 0) {
      const modules = await loadCatalog(agent.catalogModules)
      const fns = mergeCatalogs(modules)
      for (const fn of fns) catalogGlobals[fn.name] = fn.fn
      catalogSigs = formatCatalogForPrompt(modules)
    }

    // Load components
    let compGlobals: Record<string, unknown> = {}
    const resolved = resolveAgentComponents(spacePath, agent.componentRefs)

    // Local component paths
    for (const compPath of resolved.localPaths) {
      try {
        const mod = await importTs(compPath)
        for (const [name, value] of Object.entries(mod)) {
          if (typeof value === 'function' && /^[A-Z]/.test(name)) compGlobals[name] = value
        }
      } catch { /* skip */ }

      try {
        const exports = classifyExports(compPath)
        // Cross-reference .form from runtime
        for (const e of exports) {
          if (e.kind === 'component' && !e.form) {
            const fn = compGlobals[e.name] as any
            if (fn && fn.form === true) e.form = true
          }
        }
        const formatted = formatExportsForPrompt(exports.filter(e => e.kind === 'component'), compPath)
        if (formatted.formComponents) agentFormSigs += (agentFormSigs ? '\n' : '') + formatted.formComponents
        if (formatted.viewComponents) agentViewSigs += (agentViewSigs ? '\n' : '') + formatted.viewComponents
      } catch { /* skip */ }
    }

    // Catalog component groups
    if (resolved.catalogGroups.length > 0) {
      const builtinPaths = resolveComponentPaths(resolved.catalogGroups)
      for (const compPath of builtinPaths) {
        try {
          const exports = classifyExports(compPath)
          for (const e of exports) { if (e.kind === 'component') e.form = true }
          const formatted = formatExportsForPrompt(
            exports.filter(e => e.kind === 'component'),
            resolved.catalogGroups.join(', '),
            'Built-in',
          )
          if (formatted.formComponents) agentFormSigs += (agentFormSigs ? '\n' : '') + formatted.formComponents
        } catch { /* skip */ }

        try {
          const mod = await importTs(compPath)
          for (const [name, value] of Object.entries(mod)) {
            if (typeof value === 'function' && /^[A-Z]/.test(name)) compGlobals[name] = value
          }
        } catch { /* skip */ }
      }
    }

    // Load knowledge tree and apply agent knowledge config
    const spaceMap = new Map<string, string>()
    let knowledgeTreePrompt = ''

    // Build trees for all spaces
    const spacePaths = (args.spaces ?? []).map(s => resolve(s))
    const trees = spacePaths.map(sp => {
      const name = basename(sp)
      const kDir = resolve(sp, 'knowledge')
      spaceMap.set(name, kDir)
      const tree = buildKnowledgeTree(kDir)
      tree.name = name
      return tree
    })

    // Apply knowledge config: filter hidden fields, pre-load options
    const kConfig = resolveKnowledgeConfig(agent.knowledgeDefaults)

    // Filter out hidden fields from trees
    for (const tree of trees) {
      for (const domain of tree.domains) {
        const hiddenSet = kConfig.hiddenFields.get(domain.slug)
        if (hiddenSet) {
          domain.fields = domain.fields.filter(f => !hiddenSet.has(f.slug))
        }
      }
      // Remove empty domains
      tree.domains = tree.domains.filter(d => d.fields.length > 0)
    }

    if (trees.some(t => t.domains.length > 0)) {
      knowledgeTreePrompt = formatKnowledgeTreeForPrompt(trees)
    }

    // Pre-load knowledge markdown
    let preloadedKnowledge = ''
    if (kConfig.preloadOptions.length > 0) {
      const kDir = spaceMap.get(basename(spacePath))
      if (kDir) {
        const sections: string[] = []
        for (const { domain, field, option } of kConfig.preloadOptions) {
          const filePath = resolve(kDir, domain, field, `${option}.md`)
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf-8')
            const body = content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim()
            sections.push(`#### ${domain}/${field}/${option}\n${body}`)
          }
        }
        if (sections.length > 0) {
          preloadedKnowledge = `## Pre-loaded Knowledge\n\n${sections.join('\n\n')}`
        }
      }
    }

    // Parse flows for each action
    const actionFlows: Array<{ action: typeof agent.actions[0]; flow: ParsedFlow | null }> = []
    for (const action of agent.actions) {
      const flowDir = resolve(spacePath, 'flows', action.flow)
      const flow = existsSync(flowDir) ? parseFlow(flowDir) : null
      actionFlows.push({ action, flow })
    }

    // Build instruct
    const actionsPrompt = actionFlows.length > 0 ? formatActionsForPrompt(actionFlows) : ''
    const instruct = [
      agent.instruct,
      preloadedKnowledge,
      actionsPrompt ? `## Slash Actions\n\n${actionsPrompt}` : '',
      ...(args.instruct ?? []),
    ].filter(Boolean).join('\n\n')

    // Merge signatures
    const functionSignatures = [catalogSigs, agentFnSigs].filter(Boolean).join('\n')
    const formSignatures = agentFormSigs
    const viewSignatures = agentViewSigs

    // Set up knowledge namespace (always available)
    // Use the knowledge space's knowledge dir, falling back to the primary space
    const knowledgeSpaceDir = resolve(__dirname, '../../spaces/knowledge')
    const knowledgeWriteDir = resolve(knowledgeSpaceDir, 'knowledge')
    ensureMemoryDomain(knowledgeWriteDir)

    // Add knowledge space to the spaceMap so loadKnowledge can read from it
    if (!spaceMap.has('knowledge')) {
      spaceMap.set('knowledge', knowledgeWriteDir)
      const kTree = buildKnowledgeTree(knowledgeWriteDir)
      kTree.name = 'knowledge'
      trees.push(kTree)
      // Rebuild prompt with knowledge space included
      if (trees.some(t => t.domains.length > 0)) {
        knowledgeTreePrompt = formatKnowledgeTreeForPrompt(trees)
      }
    }

    // Mutable ref for session event emission
    let sessionRef: Session | null = null

    const knowledgeNamespace = createKnowledgeNamespace({
      knowledgeDir: knowledgeWriteDir,
      onKnowledgeSaved: (domain, field, option) => {
        sessionRef?.emit('event', { type: 'knowledge_saved', domain, field, option })
      },
      onKnowledgeRemoved: (domain, field, option) => {
        sessionRef?.emit('event', { type: 'knowledge_removed', domain, field, option })
      },
    })
    const knowledgeNamespacePrompt = formatKnowledgeNamespaceForPrompt()

    // Rebuild knowledge tree callback (after writes)
    const rebuildKnowledgeTree = () => {
      // Rebuild all trees from disk
      for (let i = 0; i < trees.length; i++) {
        const name = trees[i].name
        const kDir = spaceMap.get(name!)
        if (!kDir) continue
        const rebuilt = buildKnowledgeTree(kDir)
        rebuilt.name = name
        trees[i] = rebuilt
      }
      return formatKnowledgeTreeForPrompt(trees)
    }

    // Create session
    const session = new Session({
      config: { sessionTimeout: args.timeout * 1000 },
      globals: { ...catalogGlobals, ...compGlobals, ...agentGlobals },
      knowledgeLoader: spaceMap.size > 0
        ? (selector) => {
            const result: Record<string, any> = {}
            for (const [spaceName, domains] of Object.entries(selector)) {
              const kDir = spaceMap.get(spaceName)
              if (!kDir || typeof domains !== 'object' || domains === null) continue
              result[spaceName] = loadKnowledgeFiles(kDir, domains)
            }
            return result
          }
        : undefined,
      getClassInfo: classConstructors.size > 0
        ? (className) => {
            const classExport = agentClassExports.find(c => c.name === className)
            if (!classExport?.methods || !classConstructors.has(className)) return null
            return { methods: classExport.methods }
          }
        : undefined,
      loadClass: classConstructors.size > 0
        ? (className, sess) => {
            const Ctor = classConstructors.get(className)!
            const classExport = agentClassExports.find(c => c.name === className)!
            const instance = new Ctor() as any
            const bindings: Record<string, Function> = {}
            for (const m of classExport.methods!) {
              if (typeof instance[m.name] === 'function') {
                bindings[m.name] = (instance[m.name] as Function).bind(instance)
              }
            }
            sess.injectGlobal(className, bindings)
          }
        : undefined,
      knowledgeNamespace,
    })
    sessionRef = session

    // Resolve model
    const { resolveModel } = await import('../providers/resolver')
    const model = resolveModel(modelId)

    // Create agent loop with actions
    const debugFile = args.debugFile
    const agentActions = actionFlows
      .filter((af): af is { action: typeof af.action; flow: ParsedFlow } => af.flow !== null)
      .map(af => ({ id: af.action.id, flow: af.flow }))

    const agentLoop = new AgentLoop({
      session,
      model,
      modelId,
      instruct: instruct || undefined,
      functionSignatures: functionSignatures || undefined,
      formSignatures: formSignatures || undefined,
      viewSignatures: viewSignatures || undefined,
      classSignatures: agentClassSigs || undefined,
      classExports: agentClassExports.length > 0 ? agentClassExports : undefined,
      knowledgeTree: knowledgeTreePrompt || undefined,
      maxTurns: 10,
      maxTasklistReminders: 3,
      debugFile,
      actions: agentActions.length > 0 ? agentActions : undefined,
      knowledgeNamespacePrompt,
      rebuildKnowledgeTree,
    })

    // Resolve static dir for web UI
    let staticDir: string | undefined
    if (!args.noUi) {
      staticDir = resolveDistWeb()
    }

    // Start server
    const conversationsDir = resolve(spacePath, '.conversations')
    const { close } = createReplServer({
      port: args.port,
      session,
      agentLoop,
      staticDir,
      conversationsDir,
    })

    // Banner
    console.log('\x1b[36m━━━ @lmthing/repl ━━━\x1b[0m')
    console.log(`\x1b[90mAgent:   ${agent.title} (${args.agent})\x1b[0m`)
    console.log(`\x1b[90mModel:   ${modelId}\x1b[0m`)
    console.log(`\x1b[90mSpace:   ${spacePath}\x1b[0m`)
    if (agent.catalogModules.length > 0) console.log(`\x1b[90mCatalog: ${agent.catalogModules.join(', ')}\x1b[0m`)
    if (agent.localFunctions.length > 0) console.log(`\x1b[90mFuncs:   ${agent.localFunctions.join(', ')}\x1b[0m`)
    if (agent.componentRefs.length > 0) console.log(`\x1b[90mComps:   ${agent.componentRefs.join(', ')}\x1b[0m`)
    if (agent.actions.length > 0) console.log(`\x1b[90mActions: ${agent.actions.map(a => '/' + a.id).join(', ')}\x1b[0m`)
    if (debugFile) console.log(`\x1b[90mDebug:   ${debugFile}\x1b[0m`)
    if (staticDir) {
      console.log(`\x1b[90mUI:      http://localhost:${args.port}\x1b[0m`)
    } else {
      console.log(`\x1b[90mUI:      not built (run \`pnpm build:web\` or \`pnpm dev:web\` on port 3101)\x1b[0m`)
    }
    console.log(`\x1b[90mWS:      ws://localhost:${args.port}\x1b[0m`)
    console.log()

    process.on('SIGINT', () => {
      console.log('\nShutting down...')
      close()
      session.destroy()
      process.exit(0)
    })

    return
  }

  // ── File-based mode ──

  if (!args.model) {
    console.error('Error: --model is required (e.g. --model openai:gpt-4o-mini)')
    process.exit(1)
  }

  // ── Load user file (first, to read replConfig before catalog/components) ──
  let userGlobals: Record<string, unknown> = {}
  let userFnSigs = ''
  let userFormSigs = ''
  let userViewSigs = ''
  let userClassSigs = ''
  let userClassExports: ClassifiedExport[] = []
  const classConstructors = new Map<string, new () => any>()
  let setupFn: Function | null = null
  let replConfig: Record<string, any> = {}

  if (args.file) {
    const filePath = resolve(args.file)

    // Import the file first to get replConfig and runtime values
    let userModule: Record<string, unknown> = {}
    try {
      userModule = await import(filePath) as Record<string, unknown>
      for (const [name, value] of Object.entries(userModule)) {
        if (name === 'replConfig' && typeof value === 'object' && value !== null) {
          replConfig = value as Record<string, any>
          continue
        }
        if (name === 'default') {
          if (typeof value === 'function') setupFn = value as Function
          continue
        }
        if (typeof value === 'function') {
          userGlobals[name] = value
        }
      }
    } catch (err) {
      console.error(`Failed to load ${args.file}:`, err)
      process.exit(1)
    }

    // Classify exports for function/component/class signatures
    // Run after import so .form markers on the runtime module can be cross-referenced
    try {
      const exports = classifyExports(filePath)

      // Mark components as form if the runtime value has .form = true
      for (const exp of exports) {
        if (exp.kind === 'component' && !exp.form) {
          const fn = userGlobals[exp.name] as any
          if (fn && fn.form === true) exp.form = true
        }
      }

      // Separate class exports
      userClassExports = exports.filter(e => e.kind === 'class')
      const nonClassExports = exports.filter(e => e.kind !== 'class')

      // Store class constructors for later instantiation
      for (const cls of userClassExports) {
        const ctor = userModule[cls.name]
        if (typeof ctor === 'function') {
          classConstructors.set(cls.name, ctor as new () => any)
        }
      }

      const formatted = formatExportsForPrompt(exports, args.file)
      userFnSigs = formatted.functions
      userFormSigs = formatted.formComponents
      userViewSigs = formatted.viewComponents
      userClassSigs = formatted.classes
    } catch {
      // Fall back to manual signatures if classification fails
    }
  }

  // ── Load catalog modules (CLI --catalog merged with replConfig.functions) ──
  let catalogGlobals: Record<string, unknown> = {}
  let catalogSigs = ''
  const catalogSpec = args.catalog
    ? (args.catalog === 'all' ? 'all' : args.catalog.split(','))
    : (Array.isArray(replConfig.functions) ? replConfig.functions : null)
  if (catalogSpec) {
    const moduleIds = catalogSpec === 'all' ? 'all' : catalogSpec as string[]
    const modules = await loadCatalog(moduleIds)
    const fns = mergeCatalogs(modules)
    for (const fn of fns) {
      catalogGlobals[fn.name] = fn.fn
    }
    catalogSigs = formatCatalogForPrompt(modules)
  }

  // ── Load built-in components (replConfig.components: { form: [...], view: [...] }) ──
  let builtinCompGlobals: Record<string, unknown> = {}
  let builtinFormSigs = ''
  let builtinViewSigs = ''
  const compConfig = replConfig.components as { form?: string[]; view?: string[] } | undefined
  if (compConfig) {
    // Load form component groups
    if (Array.isArray(compConfig.form) && compConfig.form.length > 0) {
      const paths = resolveComponentPaths(compConfig.form)
      for (const compPath of paths) {
        try {
          const exports = classifyExports(compPath)
          // All built-in form group components are form components
          for (const e of exports) { if (e.kind === 'component') e.form = true }
          const formatted = formatExportsForPrompt(
            exports.filter(e => e.kind === 'component'),
            compConfig.form.join(', '),
            'Built-in',
          )
          if (formatted.formComponents) {
            builtinFormSigs += (builtinFormSigs ? '\n' : '') + formatted.formComponents
          }
        } catch { /* skip on failure */ }

        try {
          const mod = await import(compPath)
          for (const [name, value] of Object.entries(mod)) {
            if (typeof value === 'function' && /^[A-Z]/.test(name)) {
              builtinCompGlobals[name] = value
            }
          }
        } catch { /* skip on failure */ }
      }
    }

    // Load view component groups
    if (Array.isArray(compConfig.view) && compConfig.view.length > 0) {
      const paths = resolveComponentPaths(compConfig.view)
      for (const compPath of paths) {
        try {
          const exports = classifyExports(compPath)
          const formatted = formatExportsForPrompt(
            exports.filter(e => e.kind === 'component'),
            compConfig.view.join(', '),
            'Built-in',
          )
          if (formatted.viewComponents) {
            builtinViewSigs += (builtinViewSigs ? '\n' : '') + formatted.viewComponents
          }
        } catch { /* skip on failure */ }

        try {
          const mod = await import(compPath)
          for (const [name, value] of Object.entries(mod)) {
            if (typeof value === 'function' && /^[A-Z]/.test(name)) {
              builtinCompGlobals[name] = value
            }
          }
        } catch { /* skip on failure */ }
      }
    }
  }

  // ── Load space knowledge (multiple spaces supported) ──
  let knowledgeTreePrompt = ''
  const spaceMap = new Map<string, string>() // spaceName → knowledgeDir

  // Collect space paths from CLI args and replConfig
  const spacePaths = [
    ...(args.spaces ?? []),
    ...(Array.isArray(replConfig.spaces) ? replConfig.spaces : []),
  ].map(s => resolve(s))

  const trees = spacePaths.length > 0
    ? spacePaths.map(spacePath => {
        const name = basename(spacePath)
        const kDir = resolve(spacePath, 'knowledge')
        spaceMap.set(name, kDir)
        const tree = buildKnowledgeTree(kDir)
        tree.name = name
        return tree
      })
    : []

  // Set up knowledge namespace (always available)
  const knowledgeSpaceDir = resolve(__dirname, '../../spaces/knowledge')
  const knowledgeWriteDir = resolve(knowledgeSpaceDir, 'knowledge')
  ensureMemoryDomain(knowledgeWriteDir)

  // Add knowledge space to spaceMap so loadKnowledge can read from it
  if (!spaceMap.has('knowledge')) {
    spaceMap.set('knowledge', knowledgeWriteDir)
    const kTree = buildKnowledgeTree(knowledgeWriteDir)
    kTree.name = 'knowledge'
    trees.push(kTree)
  }

  if (trees.some(t => t.domains.length > 0)) {
    knowledgeTreePrompt = formatKnowledgeTreeForPrompt(trees)
  }

  let fileSessionRef: Session | null = null

  const knowledgeNamespace = createKnowledgeNamespace({
    knowledgeDir: knowledgeWriteDir,
    onKnowledgeSaved: (domain, field, option) => {
      fileSessionRef?.emit('event', { type: 'knowledge_saved', domain, field, option })
    },
    onKnowledgeRemoved: (domain, field, option) => {
      fileSessionRef?.emit('event', { type: 'knowledge_removed', domain, field, option })
    },
  })
  const knowledgeNamespacePrompt = formatKnowledgeNamespaceForPrompt()

  const rebuildKnowledgeTree = () => {
    for (let i = 0; i < trees.length; i++) {
      const name = trees[i].name
      const kDir = spaceMap.get(name!)
      if (!kDir) continue
      const rebuilt = buildKnowledgeTree(kDir)
      rebuilt.name = name
      trees[i] = rebuilt
    }
    return formatKnowledgeTreeForPrompt(trees)
  }

  // ── Merge config ──
  const functionSignatures = [catalogSigs, userFnSigs, replConfig.functionSignatures].filter(Boolean).join('\n')
  const formSignatures = [builtinFormSigs, userFormSigs].filter(Boolean).join('\n')
  const viewSignatures = [builtinViewSigs, userViewSigs].filter(Boolean).join('\n')

  const instructs = [
    ...(args.instruct ?? []),
    replConfig.instruct,
  ].filter(Boolean).join('\n\n')

  const maxTurns = replConfig.maxTurns ?? 10
  const maxTasklistReminders = replConfig.maxTasklistReminders ?? 3

  // ── Create session ──
  const session = new Session({
    config: { sessionTimeout: args.timeout * 1000 },
    globals: { ...catalogGlobals, ...builtinCompGlobals, ...userGlobals },
    knowledgeLoader: spaceMap.size > 0
      ? (selector) => {
          const result: Record<string, any> = {}
          for (const [spaceName, domains] of Object.entries(selector)) {
            const kDir = spaceMap.get(spaceName)
            if (!kDir || typeof domains !== 'object' || domains === null) continue
            result[spaceName] = loadKnowledgeFiles(kDir, domains)
          }
          return result
        }
      : undefined,
    getClassInfo: classConstructors.size > 0
      ? (className) => {
          const classExport = userClassExports.find(c => c.name === className)
          if (!classExport?.methods || !classConstructors.has(className)) return null
          return { methods: classExport.methods }
        }
      : undefined,
    loadClass: classConstructors.size > 0
      ? (className, sess) => {
          const Ctor = classConstructors.get(className)!
          const classExport = userClassExports.find(c => c.name === className)!

          // Instantiate and bind methods
          const instance = new Ctor() as any
          const bindings: Record<string, Function> = {}
          for (const m of classExport.methods!) {
            if (typeof instance[m.name] === 'function') {
              bindings[m.name] = (instance[m.name] as Function).bind(instance)
            }
          }

          // Inject namespace object into sandbox
          sess.injectGlobal(className, bindings)
        }
      : undefined,
    knowledgeNamespace,
  })
  fileSessionRef = session

  // ── Resolve model ──
  const { resolveModel } = await import('../providers/resolver')
  const model = resolveModel(args.model)

  // ── Create agent loop ──
  const debugFile = args.debugFile ?? replConfig.debugFile
  const agentLoop = new AgentLoop({
    session,
    model,
    modelId: args.model,
    instruct: instructs || undefined,
    functionSignatures: functionSignatures || undefined,
    formSignatures: formSignatures || undefined,
    viewSignatures: viewSignatures || undefined,
    classSignatures: userClassSigs || undefined,
    classExports: userClassExports.length > 0 ? userClassExports : undefined,
    knowledgeTree: knowledgeTreePrompt || undefined,
    maxTurns,
    maxTasklistReminders,
    debugFile,
    knowledgeNamespacePrompt,
    rebuildKnowledgeTree,
  })

  // ── Run default export setup function ──
  if (setupFn) {
    const fnSource = setupFn.toString()
    let setupCode = ''

    // Extract function body
    const openBrace = fnSource.indexOf('{')
    const closeBrace = fnSource.lastIndexOf('}')
    if (openBrace !== -1 && closeBrace > openBrace) {
      // Regular function or arrow with braces
      setupCode = fnSource.slice(openBrace + 1, closeBrace).trim()
    } else {
      // Arrow function without braces: (...) => expression
      const arrowIdx = fnSource.indexOf('=>')
      if (arrowIdx !== -1) {
        setupCode = fnSource.slice(arrowIdx + 2).trim()
      }
    }

    if (setupCode) {
      await agentLoop.runSetupCode(setupCode)
    }
  }

  // ── Resolve static dir for web UI ──
  let staticDir: string | undefined
  if (!args.noUi) {
    const distWeb = resolve(__dirname, '../../dist/web')
    if (existsSync(resolve(distWeb, 'index.html'))) {
      staticDir = distWeb
    }
  }

  // ── Start server ──
  const conversationsDir = args.file
    ? resolve(dirname(resolve(args.file)), '.conversations')
    : resolve('.conversations')
  const { close } = createReplServer({
    port: args.port,
    session,
    agentLoop,
    staticDir,
    conversationsDir,
  })

  console.log('\x1b[36m━━━ @lmthing/repl ━━━\x1b[0m')
  console.log(`\x1b[90mModel:   ${args.model}\x1b[0m`)
  if (args.file) console.log(`\x1b[90mFile:    ${args.file}\x1b[0m`)
  if (spacePaths.length > 0) console.log(`\x1b[90mSpaces:  ${spacePaths.join(', ')}\x1b[0m`)
  if (args.catalog) console.log(`\x1b[90mCatalog: ${args.catalog}\x1b[0m`)
  if (debugFile) console.log(`\x1b[90mDebug:   ${debugFile}\x1b[0m`)
  if (staticDir) {
    console.log(`\x1b[90mUI:      http://localhost:${args.port}\x1b[0m`)
  } else {
    console.log(`\x1b[90mUI:      not built (run \`pnpm build:web\` or \`pnpm dev:web\` on port 3101)\x1b[0m`)
  }
  console.log(`\x1b[90mWS:      ws://localhost:${args.port}\x1b[0m`)
  console.log()

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...')
    close()
    session.destroy()
    process.exit(0)
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
