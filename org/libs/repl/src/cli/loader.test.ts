import { describe, it, expect } from 'vitest'
import { formatExportsForPrompt } from './loader'
import type { ClassifiedExport } from './loader'

describe('cli/loader', () => {
  // Note: classifyExports requires actual TS files, tested via integration.
  // Here we test formatExportsForPrompt which is pure logic.

  describe('formatExportsForPrompt', () => {
    it('formats functions with detailed params and return type', () => {
      const exports: ClassifiedExport[] = [
        {
          name: 'searchRestaurants',
          kind: 'function',
          form: false,
          signature: '(cuisine: string, zipcode: string) => Promise<any>',
          description: 'Search for restaurants',
          params: [
            { name: 'cuisine', type: 'string', optional: false, description: 'Type of cuisine' },
            { name: 'zipcode', type: 'string', optional: false, description: 'ZIP code to search in' },
          ],
          returnType: 'Promise<any>',
          props: [],
        },
      ]
      const { functions, formComponents, viewComponents } = formatExportsForPrompt(exports, 'tools.ts')
      expect(functions).toContain('searchRestaurants(cuisine: string, zipcode: string): Promise<any>')
      expect(functions).toContain('Search for restaurants')
      expect(functions).toContain('@cuisine — Type of cuisine')
      expect(functions).toContain('@zipcode — ZIP code to search in')
      expect(functions).toContain('tools.ts')
      expect(formComponents).toBe('')
      expect(viewComponents).toBe('')
    })

    it('formats functions with optional params', () => {
      const exports: ClassifiedExport[] = [
        {
          name: 'fetchData',
          kind: 'function',
          form: false,
          signature: '(url: string, timeout?: number) => Promise<any>',
          description: '',
          params: [
            { name: 'url', type: 'string', optional: false, description: '' },
            { name: 'timeout', type: 'number', optional: true, description: '' },
          ],
          returnType: 'Promise<any>',
          props: [],
        },
      ]
      const { functions } = formatExportsForPrompt(exports)
      expect(functions).toContain('fetchData(url: string, timeout?: number): Promise<any>')
    })

    it('separates form and view components', () => {
      const exports: ClassifiedExport[] = [
        {
          name: 'RequestForm',
          kind: 'component',
          form: true,
          signature: '() => JSX.Element',
          description: 'Collect user request',
          params: [],
          returnType: '',
          props: [],
        },
        {
          name: 'RecipeCard',
          kind: 'component',
          form: false,
          signature: '(props: { name: string }) => JSX.Element',
          description: 'Show a recipe',
          params: [],
          returnType: '',
          props: [
            { name: 'name', type: 'string', optional: false, description: '' },
          ],
        },
      ]
      const { functions, formComponents, viewComponents } = formatExportsForPrompt(exports)
      expect(functions).toBe('')
      expect(formComponents).toContain('RequestForm')
      expect(formComponents).toContain('Collect user request')
      expect(formComponents).not.toContain('RecipeCard')
      expect(viewComponents).toContain('RecipeCard')
      expect(viewComponents).toContain('name={string}')
      expect(viewComponents).not.toContain('RequestForm')
    })

    it('formats view components with detailed props', () => {
      const exports: ClassifiedExport[] = [
        {
          name: 'RestaurantList',
          kind: 'component',
          form: false,
          signature: '(props: { items: Restaurant[] }) => JSX.Element',
          description: 'Renders a list of restaurants',
          params: [],
          returnType: '',
          props: [
            { name: 'items', type: 'Restaurant[]', optional: false, description: 'List of restaurants to display' },
            { name: 'limit', type: 'number', optional: true, description: 'Max items to show' },
          ],
        },
      ]
      const { viewComponents } = formatExportsForPrompt(exports)
      expect(viewComponents).toContain('<RestaurantList')
      expect(viewComponents).toContain('items={Restaurant[]}')
      expect(viewComponents).toContain('limit?={number}')
      expect(viewComponents).toContain('Renders a list')
      expect(viewComponents).toContain('@items — List of restaurants to display')
      expect(viewComponents).toContain('@limit — Max items to show')
    })

    it('formats components with no props', () => {
      const exports: ClassifiedExport[] = [
        {
          name: 'Spinner',
          kind: 'component',
          form: false,
          signature: '() => JSX.Element',
          description: '',
          params: [],
          returnType: '',
          props: [],
        },
      ]
      const { viewComponents } = formatExportsForPrompt(exports)
      expect(viewComponents).toContain('<Spinner />')
    })

    it('handles mixed exports', () => {
      const exports: ClassifiedExport[] = [
        { name: 'fetchData', kind: 'function', form: false, signature: '() => Promise<any>', description: '', params: [], returnType: 'Promise<any>', props: [] },
        { name: 'DataView', kind: 'component', form: false, signature: '() => JSX.Element', description: '', params: [], returnType: '', props: [] },
        { name: 'InputForm', kind: 'component', form: true, signature: '() => JSX.Element', description: '', params: [], returnType: '', props: [] },
      ]
      const { functions, formComponents, viewComponents } = formatExportsForPrompt(exports)
      expect(functions).toContain('fetchData')
      expect(viewComponents).toContain('DataView')
      expect(formComponents).toContain('InputForm')
    })

    it('handles empty exports', () => {
      const { functions, formComponents, viewComponents } = formatExportsForPrompt([])
      expect(functions).toBe('')
      expect(formComponents).toBe('')
      expect(viewComponents).toBe('')
    })
  })
})
