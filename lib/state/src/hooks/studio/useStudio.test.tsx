// src/hooks/studio/useStudio.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '@/lib/contexts/AppContext'
import { StudioProvider } from '@/lib/contexts/StudioContext'
import { SpaceProvider } from '@/lib/contexts/SpaceContext'
import { AppFS } from '@/lib/fs/AppFS'
import { useStudio } from './useStudio'

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

describe('useStudio', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()

    // Set up a studio with spaces
    const studioConfig = {
      id: 'test-studio',
      name: 'Test Studio',
      version: '1.0.0',
      spaces: {
        space1: {
          name: 'Space 1',
          description: 'First space',
          createdAt: '2024-01-01T00:00:00Z'
        },
        space2: {
          name: 'Space 2',
          description: 'Second space',
          createdAt: '2024-01-02T00:00:00Z'
        }
      },
      settings: {
        defaultSpace: 'space1',
        theme: 'dark' as const
      }
    }

    appFS.writeFile('alice/test-studio/lmthing.json', JSON.stringify(studioConfig, null, 2))
    appFS.writeFile('alice/test-studio/space1/package.json', '{"name": "space1"}')
    appFS.writeFile('alice/test-studio/space2/package.json', '{"name": "space2"}')
  })

  it('should return studio configuration', () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.studioConfig).not.toBeNull()
    expect(result.current.studioConfig?.id).toBe('test-studio')
    expect(result.current.studioConfig?.name).toBe('Test Studio')
  })

  it('should return list of spaces', () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.spaces).toHaveLength(2)
    expect(result.current.spaces[0].id).toBe('space1')
    expect(result.current.spaces[1].id).toBe('space2')
  })

  it('should include space configs', () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createWrapper(appFS)
    })

    const space1 = result.current.spaces.find(s => s.id === 'space1')
    expect(space1?.name).toBe('Space 1')
    expect(space1?.description).toBe('First space')
  })

  it('should return current space ID from settings', () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.currentSpaceId).toBe('space1')
  })

  it('should return studio FS', () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.studioFS).not.toBeNull()
    expect(result.current.studioFS.readFile('lmthing.json')).toContain('Test Studio')
  })

  it('should re-render when studio config changes', async () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.studioConfig?.name).toBe('Test Studio')

    const updatedConfig = {
      id: 'test-studio',
      name: 'Updated Studio',
      version: '1.0.0',
      spaces: {}
    }

    appFS.writeFile('alice/test-studio/lmthing.json', JSON.stringify(updatedConfig, null, 2))

    await waitFor(() => {
      expect(result.current.studioConfig?.name).toBe('Updated Studio')
    })
  })

  it('should allow creating a new space', async () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createWrapper(appFS)
    })

    const initialCount = result.current.spaces.length

    act(() => {
      result.current.createSpace('space3', {
        name: 'Space 3',
        description: 'Third space'
      })
    })

    await waitFor(() => {
      expect(result.current.spaces.length).toBe(initialCount + 1)
      expect(result.current.spaces.some(s => s.id === 'space3')).toBe(true)
    })
  })

  it('should allow deleting a space', async () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createWrapper(appFS)
    })

    const initialCount = result.current.spaces.length

    act(() => {
      result.current.deleteSpace('space1')
    })

    await waitFor(() => {
      expect(result.current.spaces.length).toBe(initialCount - 1)
      expect(result.current.spaces.some(s => s.id === 'space1')).toBe(false)
    })
  })

  it('should allow renaming a space', async () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createWrapper(appFS)
    })

    act(() => {
      result.current.renameSpace('space1', 'space1-renamed')
    })

    await waitFor(() => {
      expect(result.current.spaces.some(s => s.id === 'space1')).toBe(false)
      expect(result.current.spaces.some(s => s.id === 'space1-renamed')).toBe(true)
    })
  })

  it('should allow setting current space', async () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.currentSpaceId).toBe('space1')

    act(() => {
      result.current.setCurrentSpace('space2')
    })

    await waitFor(() => {
      expect(result.current.currentSpaceId).toBe('space2')
    })
  })

  it('should handle studio without spaces', () => {
    const emptyFS = new AppFS()
    emptyFS.writeFile('alice/test-studio/lmthing.json', JSON.stringify({
      id: 'test-studio',
      name: 'Empty Studio',
      spaces: {}
    }, null, 2))

    const { result } = renderHook(() => useStudio(), {
      wrapper: ({ children }) => (
        <AppProvider>
          <StudioProvider>
            <SpaceProvider>
              {children}
            </SpaceProvider>
          </StudioProvider>
        </AppProvider>
      )
    })

    expect(result.current.spaces).toEqual([])
    expect(result.current.currentSpaceId).toBeNull()
  })
})

// Helper for act
function act(fn: () => void) {
  fn()
}
