// src/hooks/fs/useFile.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../../lib/contexts/AppContext'
import { StudioProvider } from '../../lib/contexts/StudioContext'
import { SpaceProvider } from '../../lib/contexts/SpaceContext'
import { AppFS } from '../../lib/fs/AppFS'
import { useFile } from './useFile'

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

describe('useFile', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
    appFS.writeFile('alice/test/space1/file.txt', 'content')
  })

  it('should read file content', () => {
    const { result } = renderHook(() => useFile('file.txt'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBe('content')
  })

  it('should return null for non-existent file', () => {
    const { result } = renderHook(() => useFile('non-existent.txt'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should re-render when file content changes', async () => {
    const { result } = renderHook(() => useFile('file.txt'), {
      wrapper: createWrapper(appFS)
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
      wrapper: createWrapper(appFS)
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
      wrapper: createWrapper(appFS)
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
      wrapper: createWrapper(appFS)
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
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
    appFS.writeFile('alice/test/space1/file with spaces.txt', 'content')
    appFS.writeFile('alice/test/space1/file/with/slashes.md', 'markdown')
  })

  it('should handle paths with spaces', () => {
    const { result } = renderHook(() => useFile('file with spaces.txt'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBe('content')
  })

  it('should handle paths with slashes', () => {
    const { result } = renderHook(() => useFile('file/with/slashes.md'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBe('markdown')
  })
})
