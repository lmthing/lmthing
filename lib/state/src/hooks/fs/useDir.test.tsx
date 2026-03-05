// src/hooks/fs/useDir.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { createTestWrapper, getTestPath } from '@/test-utils'
import { useDir } from './useDir'

describe('useDir', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
    // Set up test directory structure
    appFS.writeFile(getTestPath('dir/file1.txt'), 'a')
    appFS.writeFile(getTestPath('dir/file2.txt'), 'b')
    appFS.writeFile(getTestPath('dir/subdir/file3.txt'), 'c')
    appFS.writeFile(getTestPath('other/file4.txt'), 'd')
  })

  it('should list directory contents', () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createTestWrapper(appFS)
    })

    const names = result.current.map(e => e.name).sort()

    expect(names).toEqual(['file1.txt', 'file2.txt', 'subdir'])
  })

  it('should return correct entry types', () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createTestWrapper(appFS)
    })

    const files = result.current.filter(e => e.type === 'file')
    const dirs = result.current.filter(e => e.type === 'dir')

    expect(files).toHaveLength(2)
    expect(dirs).toHaveLength(1)
    expect(dirs[0].name).toBe('subdir')
  })

  it('should return paths relative to space scope', () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createTestWrapper(appFS)
    })

    const entry = result.current.find(e => e.name === 'file1.txt')
    expect(entry?.path).toBe('dir/file1.txt')
  })

  it('should return empty array for non-existent directory', () => {
    const { result } = renderHook(() => useDir('non-existent'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toEqual([])
  })

  it('should list root directory', () => {
    const { result } = renderHook(() => useDir(''), {
      wrapper: createTestWrapper(appFS)
    })

    const names = result.current.map(e => e.name).sort()

    expect(names).toContain('dir')
    expect(names).toContain('other')
  })

  it('should re-render when file is added to directory', async () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = result.current.length

    // Add a new file
    appFS.writeFile(getTestPath('dir/newfile.txt'), 'new')

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount + 1)
      expect(result.current.some(e => e.name === 'newfile.txt')).toBe(true)
    })
  })

  it('should re-render when file is deleted from directory', async () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = result.current.length

    // Delete a file
    appFS.deleteFile(getTestPath('dir/file1.txt'))

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount - 1)
      expect(result.current.some(e => e.name === 'file1.txt')).toBe(false)
    })
  })

  it('should re-render when subdirectory is added', async () => {
    const { result } = renderHook(() => useDir(''), {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = result.current.length

    // Add a new directory
    appFS.writeFile(getTestPath('newdir/file.txt'), 'content')

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount + 1)
      expect(result.current.some(e => e.name === 'newdir')).toBe(true)
    })
  })

  it('should re-render when entry is renamed', async () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createTestWrapper(appFS)
    })

    // Rename a file
    appFS.renamePath(getTestPath('dir/file1.txt'), getTestPath('dir/renamed.txt'))

    await waitFor(() => {
      expect(result.current.some(e => e.name === 'file1.txt')).toBe(false)
      expect(result.current.some(e => e.name === 'renamed.txt')).toBe(true)
    })
  })

  it('should not re-render when unrelated directory changes', async () => {
    let renderCount = 0

    const { result } = renderHook(() => {
      renderCount++
      return useDir('dir')
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount

    // Modify a different directory
    appFS.writeFile(getTestPath('other/file5.txt'), 'new')

    await waitFor(() => {
      // Should not have re-rendered
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should list nested directory', () => {
    const { result } = renderHook(() => useDir('dir/subdir'), {
      wrapper: createTestWrapper(appFS)
    })

    const names = result.current.map(e => e.name)

    expect(names).toContain('file3.txt')
  })

  it('should handle directories with many entries', () => {
    // Add many files
    for (let i = 0; i < 100; i++) {
      appFS.writeFile(getTestPath(`dir/file${i}.txt`), `content${i}`)
    }

    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current.length).toBeGreaterThan(100)
  })
})
