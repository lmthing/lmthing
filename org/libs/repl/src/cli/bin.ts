#!/usr/bin/env node
import { resolve, dirname, basename } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { parseArgs } from './args'
import { classifyExports, formatExportsForPrompt, type ClassifiedExport } from './loader'
import { Session } from '../session/session'
import { AgentLoop } from './agent-loop'
import { createReplServer } from './server'
import { loadCatalog, mergeCatalogs, formatCatalogForPrompt } from '../catalog/index'
import { buildKnowledgeTree, loadKnowledgeFiles, formatKnowledgeTreeForPrompt } from '../knowledge/index'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env from the repl package root
config({ path: resolve(__dirname, '../../.env') })

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
        if (name === 'default') continue
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

  if (spacePaths.length > 0) {
    const trees = spacePaths.map(spacePath => {
      const name = basename(spacePath)
      const kDir = resolve(spacePath, 'knowledge')
      spaceMap.set(name, kDir)
      const tree = buildKnowledgeTree(kDir)
      tree.name = name
      return tree
    })
    knowledgeTreePrompt = formatKnowledgeTreeForPrompt(trees)
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
  const maxCheckpointReminders = replConfig.maxCheckpointReminders ?? 3

  // ── Create session ──
  const session = new Session({
    config: { sessionTimeout: args.timeout * 1000 },
    globals: { ...catalogGlobals, ...builtinCompGlobals, ...userGlobals },
    knowledgeLoader: spaceMap.size > 0
      ? (selector) => {
          // Selector uses space names as top-level keys:
          // { spaceName: { domain: { field: { option: true } } } }
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
  })

  // ── Resolve model ──
  // Dynamic import to avoid rootDir issues with tsc (core is a sibling package)
  const resolverPath = new URL('../../../core/src/providers/resolver.ts', import.meta.url).pathname
  const { resolveModel } = await (Function('p', 'return import(p)')(resolverPath)) as { resolveModel: (id: string) => import('ai').LanguageModel }
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
    maxCheckpointReminders,
    debugFile,
  })

  // ── Resolve static dir for web UI ──
  let staticDir: string | undefined
  if (!args.noUi) {
    const distWeb = resolve(__dirname, '../../dist/web')
    if (existsSync(resolve(distWeb, 'index.html'))) {
      staticDir = distWeb
    }
  }

  // ── Start server ──
  const { close } = createReplServer({
    port: args.port,
    session,
    agentLoop,
    staticDir,
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
