#!/usr/bin/env node
import { parseArgs } from './args'
import { Session } from '../session/session'
import { createReplServer } from './server'
import { loadCatalog, mergeCatalogs } from '../catalog/index'

async function main() {
  const args = parseArgs(process.argv.slice(2))

  // Load catalog modules if specified
  let catalogGlobals: Record<string, unknown> = {}
  if (args.catalog) {
    const moduleIds = args.catalog === 'all' ? 'all' : args.catalog.split(',')
    const modules = await loadCatalog(moduleIds)
    const fns = mergeCatalogs(modules)
    for (const fn of fns) {
      catalogGlobals[fn.name] = fn.fn
    }
  }

  // Load user file if specified
  let userGlobals: Record<string, unknown> = {}
  if (args.file) {
    try {
      const userModule = await import(args.file)
      for (const [name, value] of Object.entries(userModule)) {
        if (typeof value === 'function') {
          userGlobals[name] = value
        }
      }
    } catch (err) {
      console.error(`Failed to load ${args.file}:`, err)
      process.exit(1)
    }
  }

  // Create session
  const session = new Session({
    config: { sessionTimeout: args.timeout * 1000 },
    globals: { ...catalogGlobals, ...userGlobals },
  })

  // Start server
  const { close } = createReplServer({
    port: args.port,
    session,
  })

  console.log(`@lmthing/repl server running at http://localhost:${args.port}`)

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
