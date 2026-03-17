import { describe, it, expect } from 'vitest'
import { formatExportsForPrompt } from './loader'
import type { ClassifiedExport } from './loader'

describe('cli/loader', () => {
  // Note: classifyExports requires actual TS files, tested via integration.
  // Here we test formatExportsForPrompt which is pure logic.

  describe('formatExportsForPrompt', () => {
    it('formats functions', () => {
      const exports: ClassifiedExport[] = [
        {
          name: 'searchRestaurants',
          kind: 'function',
          signature: '(cuisine: string, zipcode: string) => Promise<any>',
          description: 'Search for restaurants',
        },
      ]
      const { functions, components } = formatExportsForPrompt(exports, 'tools.ts')
      expect(functions).toContain('searchRestaurants')
      expect(functions).toContain('Search for restaurants')
      expect(functions).toContain('tools.ts')
      expect(components).toBe('')
    })

    it('formats components', () => {
      const exports: ClassifiedExport[] = [
        {
          name: 'RestaurantList',
          kind: 'component',
          signature: '(props: { items: Restaurant[] }) => JSX.Element',
          description: 'Renders a list of restaurants',
          propsType: '{ items: Restaurant[] }',
        },
      ]
      const { functions, components } = formatExportsForPrompt(exports)
      expect(functions).toBe('')
      expect(components).toContain('RestaurantList')
      expect(components).toContain('Renders a list')
    })

    it('handles mixed exports', () => {
      const exports: ClassifiedExport[] = [
        { name: 'fetchData', kind: 'function', signature: '() => Promise<any>', description: '' },
        { name: 'DataView', kind: 'component', signature: '() => JSX.Element', description: '' },
      ]
      const { functions, components } = formatExportsForPrompt(exports)
      expect(functions).toContain('fetchData')
      expect(components).toContain('DataView')
    })

    it('handles empty exports', () => {
      const { functions, components } = formatExportsForPrompt([])
      expect(functions).toBe('')
      expect(components).toBe('')
    })
  })
})
