import { describe, it, expect } from 'vitest'
import type { CatalogFunction, CatalogModule } from './types'

describe('catalog/types', () => {
  it('CatalogFunction interface holds function metadata', () => {
    const fn: CatalogFunction = {
      name: 'readFile',
      description: 'Read file contents',
      signature: '(path: string, encoding?: string) => Promise<string>',
      fn: (path: string) => `contents of ${path}`,
    }
    expect(fn.name).toBe('readFile')
    expect(fn.fn('test.txt')).toBe('contents of test.txt')
  })

  it('CatalogModule groups functions', () => {
    const mod: CatalogModule = {
      id: 'fs',
      description: 'File system operations',
      functions: [
        {
          name: 'readFile',
          description: 'Read file',
          signature: '(path: string) => string',
          fn: () => '',
        },
        {
          name: 'writeFile',
          description: 'Write file',
          signature: '(path: string, content: string) => void',
          fn: () => {},
        },
      ],
    }
    expect(mod.id).toBe('fs')
    expect(mod.functions).toHaveLength(2)
    expect(mod.functions[0].name).toBe('readFile')
  })
})
