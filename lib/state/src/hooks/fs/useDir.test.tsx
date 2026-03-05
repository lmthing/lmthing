// src/hooks/fs/useDir.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '@/lib/contexts/AppContext'
import { StudioProvider } from '@/lib/contexts/StudioContext'
import { SpaceProvider } from '@/lib/contexts/SpaceContext'
import { AppFS } from '@/lib/fs/AppFS'
import { useDir } from './useDir'

function createWrapper(appFS: AppFS) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AppProvider>
        <StudioProvider>
          <SpaceProvider>
            {children}
          </SpaceProvider>
        </StudioProvider>
      </AppProvider>
    )
  }
}

describe('useDir', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
    // Set up test directory structure
    appFS.writeFile('alice/test/space1/dir/file1.txt', 'a')
    appFS.writeFile('alice/test/space1/dir/file2.txt', 'b')
    appFS.writeFile('alice/test/space1/dir/subdir/file3.txt', 'c')
    appFS.writeFile('alice/test/space1/other/file4.txt', 'd')
  })

  it('should list directory contents', () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createWrapper(appFS)
    })

    const names = result.current.map(e => e.name).sort()

    expect(names).toEqual(['file1.txt', 'file2.txt', 'subdir'])
  })

  it('should return correct entry types', () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createWrapper(appFS)
    })

    const files = result.current.filter(e => e.type === 'file')
    const dirs = result.current.filter(e => e.type === 'dir')

    expect(files).toHaveLength(2)
    expect(dirs).toHaveLength(1)
    expect(dirs[0].name).toBe('subdir')
  })

  it('should return paths relative to space scope', () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createWrapper(appFS)
    })

    const entry = result.current.find(e => e.name === 'file1.txt')
    expect(entry?.path).toBe('dir/file1.txt')
  })

  it('should return empty array for non-existent directory', () => {
    const { result } = renderHook(() => useDir('non-existent'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toEqual([])
  })

  it('should list root directory', () => {
    const { result } = renderHook(() => useDir(''), {
      wrapper: createWrapper(appFS)
    })

    const names = result.current.map(e => e.name).sort()

    expect(names).toContain('dir')
    expect(names).toContain('other')
  })

  it('should re-render when file is added to directory', async () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createWrapper(appFS)
    })

    const initialCount = result.current.length

    // Add a new file
    appFS.writeFile('alice/test/space1/dir/newfile.txt', 'new')

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount + 1)
      expect(result.current.some(e => e.name === 'newfile.txt')).toBe(true)
    })
  })

  it('should re-render when file is deleted from directory', async () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createWrapper(appFS)
    })

    const initialCount = result.current.length

    // Delete a file
    appFS.deleteFile('alice/test/space1/dir/file1.txt')

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount - 1)
      expect(result.current.some(e => e.name === 'file1.txt')).toBe(false)
    })
  })

  it('should re-render when subdirectory is added', async () => {
    const { result } = renderHook(() => useDir(''), {
      wrapper: createWrapper(appFS)
    })

    const initialCount = result.current.length

    // Add a new directory
    appFS.writeFile('alice/test/space1/newdir/file.txt', 'content')

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount + 1)
      expect(result.current.some(e => e.name === 'newdir')).toBe(true)
    })
  })

  it('should re-render when entry is renamed', async () => {
    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createWrapper(appFS)
    })

    // Rename a file
    appFS.renamePath('alice/test/space1/dir/file1.txt', 'alice/test/space1/dir/renamed.txt')

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
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    // Modify a different directory
    appFS.writeFile('alice/test/space1/other/file5.txt', 'new')

    await waitFor(() => {
      // Should not have re-rendered
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should list nested directory', () => {
    const { result } = renderHook(() => useDir('dir/subdir'), {
      wrapper: createWrapper(appFS)
    })

    const names = result.current.map(e => e.name)

    expect(names).toContain('file3.txt')
  })

  it('should handle directories with many entries', () => {
    // Add many files
    for (let i = 0; i < 100; i++) {
      appFS.writeFile(`alice/test/space1/dir/file${i}.txt`, `content${i}`)
    }

    const { result } = renderHook(() => useDir('dir'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.length).toBeGreaterThan(100)
  })
})
