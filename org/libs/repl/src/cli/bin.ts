#!/usr/bin/env node
import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { parseArgs } from './args'
import { classifyExports, formatExportsForPrompt } from './loader'
import { Session } from '../session/session'
import { AgentLoop } from './agent-loop'
import { createReplServer } from './server'
import { loadCatalog, mergeCatalogs, formatCatalogForPrompt } from '../catalog/index'
import { buildKnowledgeTree, loadKnowledgeFiles, formatKnowledgeTreeForPrompt } from '../knowledge/index'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env from the repl package root
config({ path: resolve(__dirname, '../../.env') })

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.model) {
    console.error('Error: --model is required (e.g. --model openai:gpt-4o-mini)')
    process.exit(1)
  }

  // ── Load catalog modules ──
  let catalogGlobals: Record<string, unknown> = {}
  let catalogSigs = ''
  if (args.catalog) {
    const moduleIds = args.catalog === 'all' ? 'all' : args.catalog.split(',')
    const modules = await loadCatalog(moduleIds)
    const fns = mergeCatalogs(modules)
    for (const fn of fns) {
      catalogGlobals[fn.name] = fn.fn
    }
    catalogSigs = formatCatalogForPrompt(modules)
  }

  // ── Load user file ──
  let userGlobals: Record<string, unknown> = {}
  let userSigs = ''
  let userInstruct = ''
  let replConfig: Record<string, any> = {}

  if (args.file) {
    const filePath = resolve(args.file)

    // Classify exports for function signatures
    try {
      const exports = classifyExports(filePath)
      const formatted = formatExportsForPrompt(exports, args.file)
      userSigs = formatted.functions
    } catch {
      // Fall back to manual signatures if classification fails
    }

    // Import the file to get actual functions
    try {
      const userModule = await import(filePath)
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
  }

  // ── Load space knowledge ──
  let knowledgeTreePrompt = ''
  let knowledgeDir = ''
  if (args.space) {
    const spacePath = resolve(args.space)
    knowledgeDir = resolve(spacePath, 'knowledge')
    const tree = buildKnowledgeTree(knowledgeDir)
    knowledgeTreePrompt = formatKnowledgeTreeForPrompt(tree)
  }

  // ── Merge config ──
  const functionSignatures = [catalogSigs, userSigs, replConfig.functionSignatures].filter(Boolean).join('\n')

  const instructs = [
    ...(args.instruct ?? []),
    replConfig.instruct,
  ].filter(Boolean).join('\n\n')

  const maxTurns = replConfig.maxTurns ?? 10
  const maxCheckpointReminders = replConfig.maxCheckpointReminders ?? 3

  // ── Create session ──
  const resolvedKnowledgeDir = knowledgeDir
  const session = new Session({
    config: { sessionTimeout: args.timeout * 1000 },
    globals: { ...catalogGlobals, ...userGlobals },
    knowledgeLoader: resolvedKnowledgeDir
      ? (selector) => loadKnowledgeFiles(resolvedKnowledgeDir, selector)
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
  if (args.space) console.log(`\x1b[90mSpace:   ${args.space}\x1b[0m`)
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
