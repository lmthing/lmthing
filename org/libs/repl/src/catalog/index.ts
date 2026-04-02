import type { CatalogModule, CatalogFunction } from './types'

const BUILTIN_MODULE_IDS = [
  'path', 'date', 'crypto', 'json', 'csv', 'env', 'fs', 'fetch', 'shell', 'image', 'db',
] as const

type BuiltinModuleId = typeof BUILTIN_MODULE_IDS[number]

/**
 * Load catalog modules by their IDs.
 * If 'all' is passed, loads all available modules.
 */
export async function loadCatalog(moduleIds: string[] | 'all'): Promise<CatalogModule[]> {
  const ids = moduleIds === 'all'
    ? [...BUILTIN_MODULE_IDS]
    : moduleIds

  const modules: CatalogModule[] = []

  for (const id of ids) {
    if (!isBuiltinModule(id)) {
      throw new Error(`Unknown catalog module: ${id}`)
    }
    const mod = await importModule(id)
    modules.push(mod)
  }

  return modules
}

function isBuiltinModule(id: string): id is BuiltinModuleId {
  return (BUILTIN_MODULE_IDS as readonly string[]).includes(id)
}

async function importModule(id: BuiltinModuleId): Promise<CatalogModule> {
  switch (id) {
    case 'path': return (await import('./path')).default
    case 'date': return (await import('./date')).default
    case 'crypto': return (await import('./crypto')).default
    case 'json': return (await import('./json')).default
    case 'csv': return (await import('./csv')).default
    case 'env': return (await import('./env')).default
    case 'fs': return (await import('./fs')).default
    case 'fetch': return (await import('./fetch')).default
    case 'shell': return (await import('./shell')).default
    case 'image': return (await import('./image')).default
    case 'db': return (await import('./db')).default
  }
}

/**
 * Merge multiple catalogs into a flat list of functions.
 */
export function mergeCatalogs(modules: CatalogModule[]): CatalogFunction[] {
  return modules.flatMap(m => m.functions)
}

/**
 * Get a specific module by ID from a loaded catalog list.
 */
export function getCatalogModule(modules: CatalogModule[], id: string): CatalogModule | undefined {
  return modules.find(m => m.id === id)
}

export { loadMcpServers, loadMcpServersFromConfig } from './mcp'
export type { McpServerEntry, McpServerConfig } from './mcp'

// Web search
export { webSearch, formatWebSearchResults, webSearchFunction, formatSearchResultsFunction } from './web-search'
export type { WebSearchResult, WebSearchResponse } from './web-search'

/**
 * Generate the system prompt block for catalog functions.
 */
export function formatCatalogForPrompt(modules: CatalogModule[]): string {
  const lines: string[] = []
  for (const mod of modules) {
    lines.push(`  # Built-in: ${mod.id}`)
    for (const fn of mod.functions) {
      lines.push(`  ${fn.name}${fn.signature}`)
      lines.push(`    — ${fn.description}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
