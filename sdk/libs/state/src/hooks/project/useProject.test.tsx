// src/hooks/project/useProject.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { useProject } from './useProject'
import { createTestWrapper } from '@/test-utils'

describe('useProject', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('exposes the project id and spaces from the pod', () => {
    const { result } = renderHook(() => useProject(), {
      wrapper: createTestWrapper(appFS, {
        projectConfig: {
          name: 'Test Project',
          spaces: {
            space1: { name: 'Space 1', description: 'First' },
            space2: { name: 'Space 2', description: 'Second' },
          },
        },
      }),
    })

    expect(result.current.projectId).toBe('test')
    expect(result.current.spaces).toHaveLength(2)
    const ids = result.current.spaces.map((s) => s.id).sort()
    expect(ids).toEqual(['space1', 'space2'])
  })

  it('exposes a ProjectFS scoped to projectId', () => {
    const { result } = renderHook(() => useProject(), {
      wrapper: createTestWrapper(appFS),
    })

    expect(result.current.projectFS).not.toBeNull()
    // lmthing.json is seeded under projectId/ by createTestWrapper.
    expect(result.current.projectFS!.readFile('lmthing.json')).toContain('Test Project')
  })

  it('supports setCurrentSpace', async () => {
    const { result } = renderHook(() => useProject(), {
      wrapper: createTestWrapper(appFS),
    })

    act(() => {
      result.current.setCurrentSpace('space1')
    })

    await waitFor(() => {
      expect(result.current.currentSpaceId).toBe('space1')
    })
  })

  it('refreshSpaces re-fetches from the transport', async () => {
    const { result } = renderHook(() => useProject(), {
      wrapper: createTestWrapper(appFS),
    })

    await waitFor(() => {
      expect(result.current.spaces.length).toBeGreaterThanOrEqual(1)
    })

    const before = result.current.spaces.length
    await act(async () => {
      await result.current.refreshSpaces()
    })
    expect(result.current.spaces).toHaveLength(before)
  })

  it('returns empty spaces when project has none', () => {
    const emptyFS = new AppFS()
    const { result } = renderHook(() => useProject(), {
      wrapper: createTestWrapper(emptyFS, { skipProjectSetup: true }),
    })

    expect(result.current.spaces).toEqual([])
    expect(result.current.currentSpaceId).toBeNull()
  })
})
