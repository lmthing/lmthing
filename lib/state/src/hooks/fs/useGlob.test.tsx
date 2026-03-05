// src/hooks/fs/useGlob.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useGlob } from './useGlob'
import { createTestWrapper, getTestPath } from '@/test-utils'

describe('useGlob', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
    // Set up test files
    appFS.writeFile(getTestPath('file1.txt'), 'a')
    appFS.writeFile(getTestPath('file2.md'), 'b')
    appFS.writeFile(getTestPath('src/file3.ts'), 'c')
    appFS.writeFile(getTestPath('src/components/file4.tsx'), 'd')
    appFS.writeFile(getTestPath('test/file5.test.ts'), 'e')
  })

  it('should match files with * pattern', () => {
    const { result } = renderHook(() => useGlob('*.txt'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toEqual(['file1.txt'])
  })

  it('should match files with ** pattern', () => {
    const { result } = renderHook(() => useGlob('**/*.ts'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toContain('src/file3.ts')
    expect(result.current).toContain('test/file5.test.ts')
  })

  it('should match files with ? pattern', () => {
    const { result } = renderHook(() => useGlob('file?.*'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toContain('file1.txt')
    expect(result.current).toContain('file2.md')
    expect(result.current).not.toContain('file3.ts')
  })

  it('should match files with character classes', () => {
    const { result } = renderHook(() => useGlob('file[12].*'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toContain('file1.txt')
    expect(result.current).toContain('file2.md')
    expect(result.current).not.toContain('file3.ts')
  })

  it('should match files with extglob patterns', () => {
    const { result } = renderHook(() => useGlob('*.@(txt|md)'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toContain('file1.txt')
    expect(result.current).toContain('file2.md')
    expect(result.current).not.toContain('file3.ts')
  })

  it('should return paths relative to space scope', () => {
    const { result } = renderHook(() => useGlob('**/*.ts'), {
      wrapper: createTestWrapper(appFS)
    })

    // Paths should not include the full AppFS path
    expect(result.current.every(p => !p.startsWith('alice/'))).toBe(true)
  })

  it('should return empty array for no matches', () => {
    const { result } = renderHook(() => useGlob('*.xyz'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toEqual([])
  })

  it('should re-render when matching file is created', async () => {
    const { result } = renderHook(() => useGlob('*.txt'), {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = result.current.length

    // Add a matching file
    appFS.writeFile(getTestPath('new.txt'), 'new')

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount + 1)
      expect(result.current).toContain('new.txt')
    })
  })

  it('should re-render when matching file is deleted', async () => {
    const { result } = renderHook(() => useGlob('*.txt'), {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = result.current.length

    // Delete a matching file
    appFS.deleteFile(getTestPath('file1.txt'))

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount - 1)
    })
  })

  it('should re-render when matching file is modified', async () => {
    let renderCount = 0

    const { result } = renderHook(() => {
      renderCount++
      return useGlob('*.txt')
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount

    // Modify a matching file
    appFS.writeFile(getTestPath('file1.txt'), 'updated')

    await waitFor(() => {
      expect(renderCount).toBeGreaterThan(initialCount)
    })
  })

  it('should not re-render when non-matching file changes', async () => {
    let renderCount = 0

    const { result } = renderHook(() => {
      renderCount++
      return useGlob('*.txt')
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount

    // Modify a non-matching file
    appFS.writeFile(getTestPath('file2.md'), 'updated')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle negated patterns', () => {
    appFS.writeFile(getTestPath('exclude.txt'), 'x')

    const { result } = renderHook(() => useGlob('!*.md'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toContain('file1.txt')
    expect(result.current).not.toContain('file2.md')
  })

  it('should match nested files with **', () => {
    const { result } = renderHook(() => useGlob('**/file*.ts'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toContain('src/file3.ts')
    expect(result.current).toContain('test/file5.test.ts')
  })

  it('should handle complex patterns', () => {
    const { result } = renderHook(() => useGlob('src/**/*.ts*'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toContain('src/file3.ts')
    expect(result.current).toContain('src/components/file4.tsx')
  })

  it('should sort results alphabetically by default', () => {
    const { result } = renderHook(() => useGlob('**/*'), {
      wrapper: createTestWrapper(appFS)
    })

    const sorted = [...result.current].sort()
    expect(result.current).toEqual(sorted)
  })
})

describe('useGlob with empty space', () => {
  it('should handle empty file system', () => {
    const appFS = new AppFS()

    const { result } = renderHook(() => useGlob('**/*'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toEqual([])
  })
})
