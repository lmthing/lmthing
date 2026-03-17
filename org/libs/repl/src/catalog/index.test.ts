import { describe, it, expect } from 'vitest'
import { loadCatalog, mergeCatalogs, getCatalogModule, formatCatalogForPrompt } from './index'

describe('catalog/index', () => {
  it('loads a single module', async () => {
    const modules = await loadCatalog(['path'])
    expect(modules).toHaveLength(1)
    expect(modules[0].id).toBe('path')
    expect(modules[0].functions.length).toBeGreaterThan(0)
  })

  it('loads multiple modules', async () => {
    const modules = await loadCatalog(['path', 'date', 'crypto'])
    expect(modules).toHaveLength(3)
    expect(modules.map(m => m.id)).toEqual(['path', 'date', 'crypto'])
  })

  it('loads all modules', async () => {
    const modules = await loadCatalog('all')
    expect(modules.length).toBeGreaterThanOrEqual(10)
  })

  it('throws on unknown module', async () => {
    await expect(loadCatalog(['nonexistent'])).rejects.toThrow('Unknown catalog module')
  })

  it('mergeCatalogs flattens into function list', async () => {
    const modules = await loadCatalog(['path', 'crypto'])
    const fns = mergeCatalogs(modules)
    expect(fns.length).toBe(modules[0].functions.length + modules[1].functions.length)
    expect(fns.every(f => f.name && f.fn)).toBe(true)
  })

  it('getCatalogModule finds by id', async () => {
    const modules = await loadCatalog(['path', 'date'])
    expect(getCatalogModule(modules, 'date')?.id).toBe('date')
    expect(getCatalogModule(modules, 'crypto')).toBeUndefined()
  })

  it('formatCatalogForPrompt generates readable output', async () => {
    const modules = await loadCatalog(['path'])
    const output = formatCatalogForPrompt(modules)
    expect(output).toContain('# Built-in: path')
    expect(output).toContain('joinPath')
    expect(output).toContain('Join path segments')
  })
})
