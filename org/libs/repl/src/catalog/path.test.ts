import { describe, it, expect } from 'vitest'
import pathModule from './path'

describe('catalog/path', () => {
  const fns = Object.fromEntries(pathModule.functions.map(f => [f.name, f.fn]))

  it('joinPath joins segments', () => {
    expect(fns.joinPath('a', 'b', 'c')).toBe('a/b/c')
  })

  it('resolvePath resolves to absolute', () => {
    const result = fns.resolvePath('/base', 'sub')
    expect(result).toBe('/base/sub')
  })

  it('relativePath computes relative path', () => {
    expect(fns.relativePath('/a/b', '/a/c')).toBe('../c')
  })

  it('parsePath parses components', () => {
    const result = fns.parsePath('/home/user/file.txt') as any
    expect(result.base).toBe('file.txt')
    expect(result.ext).toBe('.txt')
    expect(result.name).toBe('file')
  })

  it('dirname returns directory', () => {
    expect(fns.dirname('/a/b/c.txt')).toBe('/a/b')
  })

  it('basename returns base name', () => {
    expect(fns.basename('/a/b/c.txt')).toBe('c.txt')
    expect(fns.basename('/a/b/c.txt', '.txt')).toBe('c')
  })

  it('extname returns extension', () => {
    expect(fns.extname('file.ts')).toBe('.ts')
  })
})
