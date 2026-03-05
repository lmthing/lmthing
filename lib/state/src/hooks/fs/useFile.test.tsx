// src/hooks/fs/useFile.test.tsx

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createTestAppFS, createTestWrapper, clearTestStorage } from '@/test-utils'
import { useFile } from './useFile'

describe('useFile', () => {
  let appFS: ReturnType<typeof createTestAppFS>

  beforeEach(() => {
    appFS = createTestAppFS()
    appFS.writeFile('alice/test/space1/file.txt', 'content')
  })

  afterEach(() => {
    clearTestStorage()
  })

  it('should read file content', () => {
    const { result } = renderHook(() => useFile('file.txt'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toBe('content')
  })

  it('should return null for non-existent file', () => {
    const { result } = renderHook(() => useFile('non-existent.txt'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toBeNull()
  })

  it('should re-render when file content changes', async () => {
    const { result } = renderHook(() => useFile('file.txt'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toBe('content')

    // Update the file through the AppFS
    appFS.writeFile('alice/test/space1/file.txt', 'updated content')

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
      wrapper: createTestWrapper({ appFS })
    })

    const initialCount = renderCount.count

    // Update a different file
    appFS.writeFile('alice/test/space1/other.txt', 'other')

    await waitFor(() => {
      // Should not have re-rendered
      expect(renderCount.count).toBe(initialCount)
    })
  })

  it('should handle create events', async () => {
    const { result } = renderHook(() => useFile('new.txt'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toBeNull()

    // Create the file
    appFS.writeFile('alice/test/space1/new.txt', 'new content')

    await waitFor(() => {
      expect(result.current).toBe('new content')
    })
  })

  it('should handle delete events', async () => {
    const { result } = renderHook(() => useFile('file.txt'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toBe('content')

    // Delete the file
    appFS.deleteFile('alice/test/space1/file.txt')

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })
})

describe('useFile with special characters in path', () => {
  let appFS: ReturnType<typeof createTestAppFS>

  beforeEach(() => {
    appFS = createTestAppFS()
    appFS.writeFile('alice/test/space1/file with spaces.txt', 'content')
    appFS.writeFile('alice/test/space1/file/with/slashes.md', 'markdown')
  })

  afterEach(() => {
    clearTestStorage()
  })

  it('should handle paths with spaces', () => {
    const { result } = renderHook(() => useFile('file with spaces.txt'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toBe('content')
  })

  it('should handle paths with slashes', () => {
    const { result } = renderHook(() => useFile('file/with/slashes.md'), {
      wrapper: createTestWrapper({ appFS })
    })

    expect(result.current).toBe('markdown')
  })
})
