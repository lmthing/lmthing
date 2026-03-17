import { describe, it, expect } from 'vitest'
import { parseStatement, extractDeclarations, recoverArgumentNames, extractVariableNames } from './ast-utils'

describe('parser/ast-utils', () => {
  describe('parseStatement', () => {
    it('parses a variable declaration', () => {
      const node = parseStatement('const x = 1')
      expect(node).not.toBeNull()
    })

    it('parses a function call', () => {
      const node = parseStatement('console.log("hello")')
      expect(node).not.toBeNull()
    })

    it('returns null for empty input', () => {
      expect(parseStatement('')).toBeNull()
    })

    it('parses JSX', () => {
      const node = parseStatement('const el = <div>hello</div>')
      expect(node).not.toBeNull()
    })
  })

  describe('extractDeclarations', () => {
    it('extracts const declarations', () => {
      expect(extractDeclarations('const x = 1')).toEqual(['x'])
    })

    it('extracts let declarations', () => {
      expect(extractDeclarations('let y = "hello"')).toEqual(['y'])
    })

    it('extracts multiple declarations', () => {
      expect(extractDeclarations('const a = 1, b = 2')).toEqual(['a', 'b'])
    })

    it('extracts object destructuring', () => {
      const names = extractDeclarations('const { name, age } = user')
      expect(names).toContain('name')
      expect(names).toContain('age')
    })

    it('extracts array destructuring', () => {
      const names = extractDeclarations('const [first, second] = arr')
      expect(names).toContain('first')
      expect(names).toContain('second')
    })

    it('extracts function declaration name', () => {
      expect(extractDeclarations('function greet() {}')).toEqual(['greet'])
    })

    it('extracts class declaration name', () => {
      expect(extractDeclarations('class MyClass {}')).toEqual(['MyClass'])
    })

    it('returns empty for expression statements', () => {
      expect(extractDeclarations('console.log("hi")')).toEqual([])
    })

    it('returns empty for empty input', () => {
      expect(extractDeclarations('')).toEqual([])
    })
  })

  describe('recoverArgumentNames', () => {
    it('recovers simple identifiers', () => {
      expect(recoverArgumentNames('stop(x)')).toEqual(['x'])
    })

    it('recovers multiple arguments', () => {
      expect(recoverArgumentNames('stop(x, y, z)')).toEqual(['x', 'y', 'z'])
    })

    it('recovers property access expressions', () => {
      expect(recoverArgumentNames('stop(user.name)')).toEqual(['user.name'])
    })

    it('recovers element access expressions', () => {
      expect(recoverArgumentNames('stop(arr[0])')).toEqual(['arr[0]'])
    })

    it('falls back to arg_N for complex expressions', () => {
      expect(recoverArgumentNames('stop(getX())')).toEqual(['arg_0'])
    })

    it('handles await stop', () => {
      expect(recoverArgumentNames('await stop(x, y)')).toEqual(['x', 'y'])
    })

    it('handles mixed argument types', () => {
      const names = recoverArgumentNames('stop(user.name, x, getX())')
      expect(names).toEqual(['user.name', 'x', 'arg_2'])
    })

    it('returns empty for non-global calls', () => {
      expect(recoverArgumentNames('console.log(x)')).toEqual([])
    })

    it('handles assignment form', () => {
      expect(recoverArgumentNames('const val = ask(<Form />)')).toEqual(['arg_0'])
    })
  })

  describe('extractVariableNames', () => {
    it('extracts identifiers', () => {
      const names = extractVariableNames('x + y')
      expect(names).toContain('x')
      expect(names).toContain('y')
    })

    it('does not include property names from member access', () => {
      const names = extractVariableNames('user.name')
      expect(names).toContain('user')
      expect(names).not.toContain('name')
    })

    it('extracts from complex expressions', () => {
      const names = extractVariableNames('foo(bar, baz.qux)')
      expect(names).toContain('foo')
      expect(names).toContain('bar')
      expect(names).toContain('baz')
    })
  })
})
