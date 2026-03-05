// src/hooks/studio/useStudio.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useStudio } from './useStudio'
import { createTestWrapper } from '@/test-utils'

describe('useStudio', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()

    // Set up a studio with spaces
    const studioConfig = {
      id: 'test',
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

    appFS.writeFile('alice/test/lmthing.json', JSON.stringify(studioConfig, null, 2))
    appFS.writeFile('alice/test/space1/package.json', '{"name": "space1"}')
    appFS.writeFile('alice/test/space2/package.json', '{"name": "space2"}')
  })

  it('should return studio configuration', () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current.studioConfig).not.toBeNull()
    expect(result.current.studioConfig?.id).toBe('test')
    expect(result.current.studioConfig?.name).toBe('Test Studio')
  })

  it('should return list of spaces', () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current.spaces).toHaveLength(2)
    expect(result.current.spaces[0].id).toBe('space1')
    expect(result.current.spaces[1].id).toBe('space2')
  })

  it('should include space configs', () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    const space1 = result.current.spaces.find(s => s.id === 'space1')
    expect(space1?.name).toBe('Space 1')
    expect(space1?.description).toBe('First space')
  })

  it('should return current space ID from settings', () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current.currentSpaceId).toBe('space1')
  })

  it('should return studio FS', () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current.studioFS).not.toBeNull()
    expect(result.current.studioFS.readFile('lmthing.json')).toContain('Test Studio')
  })

  it('should re-render when studio config changes', async () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
    })

    expect(result.current.studioConfig?.name).toBe('Test Studio')

    const updatedConfig = {
      id: 'test',
      name: 'Updated Studio',
      version: '1.0.0',
      spaces: {}
    }

    appFS.writeFile('alice/test/lmthing.json', JSON.stringify(updatedConfig, null, 2))

    await waitFor(() => {
      expect(result.current.studioConfig?.name).toBe('Updated Studio')
    })
  })

  it('should allow creating a new space', async () => {
    const { result } = renderHook(() => useStudio(), {
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
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
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
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
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
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
      wrapper: createTestWrapper(appFS, { skipStudioSetup: true })
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
    emptyFS.writeFile('alice/test/lmthing.json', JSON.stringify({
      id: 'test',
      name: 'Empty Studio',
      spaces: {}
    }, null, 2))

    const { result } = renderHook(() => useStudio(), {
      wrapper: createTestWrapper(emptyFS, { skipStudioSetup: true })
    })

    expect(result.current.spaces).toEqual([])
    expect(result.current.currentSpaceId).toBeNull()
  })
})
