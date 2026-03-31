/**
 * runAgent — programmatic equivalent of the CLI bin.ts entry point.
 *
 * Loads a user file, classifies its exports (functions, components, classes),
 * resolves catalog/components/knowledge, creates a Session + AgentLoop,
 * and optionally starts the WebSocket server.
 */

import { resolve, dirname, basename } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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
import type { KnowledgeTree } from '@lmthing/repl'
import { AgentLoop } from './agent-loop'
import { createReplServer } from './server'
import { buildSpaceAgentTrees, createNamespaceGlobals, formatAgentTreeForPrompt, createKnowledgeNamespace, formatKnowledgeNamespaceForPrompt } from '../agent-namespaces'
import type { LanguageModel } from 'ai'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface RunAgentOptions {
  /** LLM model — either a resolved LanguageModel or a string ID like "openai:gpt-4o-mini" */
  model: LanguageModel | string
  /** Special instructions appended to system prompt */
  instruct?: string[]
  /** Built-in catalog modules to enable (array of IDs, or "all") */
  catalog?: string[] | 'all'
  /** Paths to space directories containing knowledge/ */
  spaces?: string[]
  /** Session timeout in seconds (default: 600) */
  timeout?: number
  /** Max agent turns per message (default from replConfig or 10) */
  maxTurns?: number
  /** Max tasklist reminders (default from replConfig or 3) */
  maxTasklistReminders?: number
  /** Path to write a debug log file (JSON or XML) */
  debugFile?: string
  /** Port to start WebSocket server on. If omitted, no server is started. */
  port?: number
  /** Disable serving the web UI when port is set */
  noUi?: boolean
}

export interface RunAgentResult {
  session: Session
  agentLoop: AgentLoop
  /** Only present when `port` was specified */
  close?: () => void
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

/**
 * Load a user file and start an agent session programmatically.
 *
 * Equivalent to the CLI but returns the Session and AgentLoop for
 * programmatic interaction (call `agentLoop.handleMessage(text)`).
 */
export async function runAgent(
  filePath: string,
  opts: RunAgentOptions,
): Promise<RunAgentResult> {
  const absolutePath = resolve(filePath)

  // ── Load user file ──
  let userGlobals: Record<string, unknown> = {}
  let userFnSigs = ''
  let userFormSigs = ''
  let userViewSigs = ''
  let userClassSigs = ''
  let userClassExports: ClassifiedExport[] = []
  const classConstructors = new Map<string, new () => any>()
  let setupFn: Function | null = null
  let replConfig: Record<string, any> = {}

  let userModule: Record<string, unknown> = {}
  try {
    userModule = await importTs(absolutePath)
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
    throw new Error(`Failed to load ${filePath}: ${err}`)
  }

  // Classify exports for function/component/class signatures
  try {
    const exports = classifyExports(absolutePath)

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

    // Store class constructors
    for (const cls of userClassExports) {
      const ctor = userModule[cls.name]
      if (typeof ctor === 'function') {
        classConstructors.set(cls.name, ctor as new () => any)
      }
    }

    const formatted = formatExportsForPrompt(exports, filePath)
    userFnSigs = formatted.functions
    userFormSigs = formatted.formComponents
    userViewSigs = formatted.viewComponents
    userClassSigs = formatted.classes
  } catch {
    // Fall back if classification fails
  }

  // ── Load catalog modules ──
  let catalogGlobals: Record<string, unknown> = {}
  let catalogSigs = ''
  const catalogSpec = opts.catalog
    ?? (Array.isArray(replConfig.functions) ? replConfig.functions : null)
  if (catalogSpec) {
    const moduleIds = catalogSpec === 'all' ? 'all' : catalogSpec as string[]
    const modules = await loadCatalog(moduleIds)
    const fns = mergeCatalogs(modules)
    for (const fn of fns) {
      catalogGlobals[fn.name] = fn.fn
    }
    catalogSigs = formatCatalogForPrompt(modules)
  }

  // ── Load built-in components ──
  let builtinCompGlobals: Record<string, unknown> = {}
  let builtinFormSigs = ''
  let builtinViewSigs = ''
  const compConfig = replConfig.components as { form?: string[]; view?: string[] } | undefined
  if (compConfig) {
    if (Array.isArray(compConfig.form) && compConfig.form.length > 0) {
      const paths = resolveComponentPaths(compConfig.form)
      for (const compPath of paths) {
        try {
          const exports = classifyExports(compPath)
          for (const e of exports) { if (e.kind === 'component') e.form = true }
          const formatted = formatExportsForPrompt(
            exports.filter(e => e.kind === 'component'),
            compConfig.form.join(', '),
            'Built-in',
          )
          if (formatted.formComponents) {
            builtinFormSigs += (builtinFormSigs ? '\n' : '') + formatted.formComponents
          }
        } catch { /* skip */ }

        try {
          const mod = await importTs(compPath)
          for (const [name, value] of Object.entries(mod)) {
            if (typeof value === 'function' && /^[A-Z]/.test(name)) {
              builtinCompGlobals[name] = value
            }
          }
        } catch { /* skip */ }
      }
    }

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
        } catch { /* skip */ }

        try {
          const mod = await importTs(compPath)
          for (const [name, value] of Object.entries(mod)) {
            if (typeof value === 'function' && /^[A-Z]/.test(name)) {
              builtinCompGlobals[name] = value
            }
          }
        } catch { /* skip */ }
      }
    }
  }

  // ── Load space knowledge ──
  let knowledgeTreePrompt = ''
  const spaceMap = new Map<string, string>()
  let knowledgeTrees: KnowledgeTree[] = []

  const spacePaths = [
    ...(opts.spaces ?? []),
    ...(Array.isArray(replConfig.spaces) ? replConfig.spaces : []),
  ].map(s => resolve(s))

  if (spacePaths.length > 0) {
    knowledgeTrees = spacePaths.map(spacePath => {
      const name = basename(spacePath)
      const kDir = resolve(spacePath, 'knowledge')
      spaceMap.set(name, kDir)
      const tree = buildKnowledgeTree(kDir)
      tree.name = name
      return tree
    })
    knowledgeTreePrompt = formatKnowledgeTreeForPrompt(knowledgeTrees)
  }

  // ── Build agent namespace trees ──
  let agentNamespaces: Record<string, unknown> = {}
  let agentTreePrompt = ''

  if (spacePaths.length > 0) {
    const agentTrees = buildSpaceAgentTrees(spacePaths, knowledgeTrees)
    const onSpawnStub = async () => {
      throw new Error('Agent spawning not yet implemented — Phase 1a required')
    }
    agentNamespaces = createNamespaceGlobals(agentTrees, onSpawnStub)
    agentTreePrompt = formatAgentTreeForPrompt(agentTrees)
  }

  // ── Set up knowledge namespace (always available) ──
  const knowledgeSpaceDir = resolve(__dirname, '../../spaces/knowledge')
  const knowledgeWriteDir = resolve(knowledgeSpaceDir, 'knowledge')
  ensureMemoryDomain(knowledgeWriteDir)

  // Add knowledge space to spaceMap so loadKnowledge can read from it
  if (!spaceMap.has('knowledge')) {
    spaceMap.set('knowledge', knowledgeWriteDir)
    const kTree = buildKnowledgeTree(knowledgeWriteDir)
    kTree.name = 'knowledge'
    knowledgeTrees.push(kTree)
    knowledgeTreePrompt = formatKnowledgeTreeForPrompt(knowledgeTrees)
  }

  let runAgentSessionRef: Session | null = null

  const knowledgeNamespace = createKnowledgeNamespace({
    knowledgeDir: knowledgeWriteDir,
    onKnowledgeSaved: (domain, field, option) => {
      runAgentSessionRef?.emit('event', { type: 'knowledge_saved', domain, field, option })
    },
    onKnowledgeRemoved: (domain, field, option) => {
      runAgentSessionRef?.emit('event', { type: 'knowledge_removed', domain, field, option })
    },
  })
  const knowledgeNamespacePrompt = formatKnowledgeNamespaceForPrompt()

  const rebuildKnowledgeTree = () => {
    for (let i = 0; i < knowledgeTrees.length; i++) {
      const name = knowledgeTrees[i].name
      const kDir = spaceMap.get(name!)
      if (!kDir) continue
      const rebuilt = buildKnowledgeTree(kDir)
      rebuilt.name = name
      knowledgeTrees[i] = rebuilt
    }
    return formatKnowledgeTreeForPrompt(knowledgeTrees)
  }

  // ── Merge config ──
  const functionSignatures = [catalogSigs, userFnSigs, replConfig.functionSignatures].filter(Boolean).join('\n')
  const formSignatures = [builtinFormSigs, userFormSigs].filter(Boolean).join('\n')
  const viewSignatures = [builtinViewSigs, userViewSigs].filter(Boolean).join('\n')

  const instructs = [
    ...(opts.instruct ?? []),
    replConfig.instruct,
  ].filter(Boolean).join('\n\n')

  const maxTurns = opts.maxTurns ?? replConfig.maxTurns ?? 10
  const maxTasklistReminders = opts.maxTasklistReminders ?? replConfig.maxTasklistReminders ?? 3
  const timeout = opts.timeout ?? 600

  // ── Shared refs (used by both Session and AgentLoop for spawn context) ──
  const allGlobals = { ...catalogGlobals, ...builtinCompGlobals, ...userGlobals }

  const knowledgeLoader = spaceMap.size > 0
    ? (selector: Record<string, any>) => {
        const result: Record<string, any> = {}
        for (const [spaceName, domains] of Object.entries(selector)) {
          const kDir = spaceMap.get(spaceName)
          if (!kDir || typeof domains !== 'object' || domains === null) continue
          result[spaceName] = loadKnowledgeFiles(kDir, domains as any)
        }
        return result
      }
    : undefined

  const getClassInfo = classConstructors.size > 0
    ? (className: string) => {
        const classExport = userClassExports.find(c => c.name === className)
        if (!classExport?.methods || !classConstructors.has(className)) return null
        return { methods: classExport.methods }
      }
    : undefined

  const loadClassFn = classConstructors.size > 0
    ? (className: string, sess: Session) => {
        const Ctor = classConstructors.get(className)!
        const classExport = userClassExports.find(c => c.name === className)!
        const instance = new Ctor() as any
        const bindings: Record<string, Function> = {}
        for (const m of classExport.methods!) {
          if (typeof instance[m.name] === 'function') {
            bindings[m.name] = (instance[m.name] as Function).bind(instance)
          }
        }
        sess.injectGlobal(className, bindings)
      }
    : undefined

  // ── Create session ──
  let agentLoopRef: AgentLoop | null = null
  const session = new Session({
    config: { sessionTimeout: timeout * 1000 },
    globals: allGlobals,
    knowledgeLoader,
    getClassInfo,
    loadClass: loadClassFn,
    agentNamespaces: Object.keys(agentNamespaces).length > 0 ? agentNamespaces : undefined,
    knowledgeNamespace,
    onContextBudget: () => agentLoopRef!.getContextBudget(),
    onReflect: (request) => agentLoopRef!.handleReflect(request),
    onCompress: (data, options) => agentLoopRef!.handleCompress(data, options),
    onFork: (request) => agentLoopRef!.handleFork(request),
    onTrace: () => agentLoopRef!.getTrace(),
    onPlan: (goal, constraints) => agentLoopRef!.handlePlan(goal, constraints),
    onCritique: (output, criteria, context) => agentLoopRef!.handleCritique(output, criteria, context),
  })
  runAgentSessionRef = session

  // ── Resolve model ──
  let model: LanguageModel
  let modelId: string
  if (typeof opts.model === 'string') {
    modelId = opts.model
    const { resolveModel } = await import('../providers/resolver')
    model = resolveModel(opts.model) as LanguageModel
  } else {
    model = opts.model
    modelId = (model as any).modelId ?? 'unknown'
  }

  // ── Create agent loop ──
  const debugFile = opts.debugFile ?? replConfig.debugFile

  const agentLoop = new AgentLoop({
    session,
    model,
    modelId,
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
    catalogGlobals: allGlobals,
    knowledgeLoader,
    getClassInfo,
    loadClass: loadClassFn,
    agentTree: agentTreePrompt || undefined,
    knowledgeNamespacePrompt,
    rebuildKnowledgeTree,
  })
  agentLoopRef = agentLoop

  // ── Run default export setup function ──
  if (setupFn) {
    const fnSource = setupFn.toString()
    let setupCode = ''

    const openBrace = fnSource.indexOf('{')
    const closeBrace = fnSource.lastIndexOf('}')
    if (openBrace !== -1 && closeBrace > openBrace) {
      setupCode = fnSource.slice(openBrace + 1, closeBrace).trim()
    } else {
      const arrowIdx = fnSource.indexOf('=>')
      if (arrowIdx !== -1) {
        setupCode = fnSource.slice(arrowIdx + 2).trim()
      }
    }

    if (setupCode) {
      await agentLoop.runSetupCode(setupCode)
    }
  }

  // ── Optionally start server ──
  let close: (() => void) | undefined
  if (opts.port != null) {
    let staticDir: string | undefined
    if (!opts.noUi) {
      for (const rel of ['web', '../../dist/web']) {
        const p = resolve(__dirname, rel)
        if (existsSync(resolve(p, 'index.html'))) { staticDir = p; break }
      }
    }

    const conversationsDir = resolve(dirname(absolutePath), '.conversations')

    const server = createReplServer({
      port: opts.port,
      session,
      agentLoop,
      staticDir,
      conversationsDir,
    })
    close = server.close
  }

  return { session, agentLoop, close }
}
