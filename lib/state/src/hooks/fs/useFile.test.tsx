// src/hooks/fs/useFile.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { createTestWrapper, getTestPath } from '@/test-utils'
import { useFile } from './useFile'

describe('useFile', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
    appFS.writeFile(getTestPath('file.txt'), 'content')
  })

  it('should read file content', () => {
    const { result } = renderHook(() => useFile('file.txt'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBe('content')
  })

  it('should return null for non-existent file', () => {
    const { result } = renderHook(() => useFile('non-existent.txt'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should re-render when file content changes', async () => {
    const { result } = renderHook(() => useFile('file.txt'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBe('content')

    // Update the file through the AppFS
    appFS.writeFile(getTestPath('file.txt'), 'updated content')

    await waitFor(() => {
      expect(result.current).toBe('updated content')
    })
  })

  it('should not re-render when different file changes', async () => {
    const renderCount = { count: 0 }
    const { result } = renderHook(() => {
      renderCount.count++
      return useFile('file.txt')
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount.count

    // Update a different file
    appFS.writeFile(getTestPath('other.txt'), 'other')

    await waitFor(() => {
      // Should not have re-rendered
      expect(renderCount.count).toBe(initialCount)
    })
  })

  it('should handle create events', async () => {
    const { result } = renderHook(() => useFile('new.txt'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBeNull()

    // Create the file
    appFS.writeFile(getTestPath('new.txt'), 'new content')

    await waitFor(() => {
      expect(result.current).toBe('new content')
    })
  })

  it('should handle delete events', async () => {
    const { result } = renderHook(() => useFile('file.txt'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBe('content')

    // Delete the file
    appFS.deleteFile(getTestPath('file.txt'))

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })
})

describe('useFile with special characters in path', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
    appFS.writeFile(getTestPath('file with spaces.txt'), 'content')
    appFS.writeFile(getTestPath('file/with/slashes.md'), 'markdown')
  })

  it('should handle paths with spaces', () => {
    const { result } = renderHook(() => useFile('file with spaces.txt'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBe('content')
  })

  it('should handle paths with slashes', () => {
    const { result } = renderHook(() => useFile('file/with/slashes.md'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBe('markdown')
  })
})
