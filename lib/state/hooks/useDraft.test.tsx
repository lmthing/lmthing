// src/hooks/useDraft.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../../../lib/contexts/AppContext'
import { DraftStore } from '../../../lib/fs/DraftStore'
import { useDraft, useHasDraft, useDraftMutations, useUnsavedPaths } from './useDraft'

function createWrapper(draftStore: DraftStore) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AppProvider>
        {children}
      </AppProvider>
    )
  }
}

// Mock the useApp hook to return our test draft store
vi.mock('../studio/useApp', () => ({
  useApp: () => ({
    drafts: mockDraftStore
  })
}))

let mockDraftStore: DraftStore

describe('useDraft', () => {
  beforeEach(() => {
    mockDraftStore = new DraftStore()
  })

  it('should return draft content when draft exists', () => {
    mockDraftStore.set('test.txt', 'draft content')

    const { result } = renderHook(() => useDraft('test.txt'))

    expect(result.current).toBe('draft content')
  })

  it('should return undefined when no draft exists', () => {
    const { result } = renderHook(() => useDraft('non-existent.txt'))

    expect(result.current).toBeUndefined()
  })

  it('should re-render when draft is set', async () => {
    const { result } = renderHook(() => useDraft('test.txt'))

    expect(result.current).toBeUndefined()

    act(() => {
      mockDraftStore.set('test.txt', 'new draft')
    })

    await waitFor(() => {
      expect(result.current).toBe('new draft')
    })
  })

  it('should re-render when draft is deleted', async () => {
    mockDraftStore.set('test.txt', 'content')

    const { result } = renderHook(() => useDraft('test.txt'))

    expect(result.current).toBe('content')

    act(() => {
      mockDraftStore.delete('test.txt')
    })

    await waitFor(() => {
      expect(result.current).toBeUndefined()
    })
  })

  it('should not re-render when different draft changes', async () => {
    let renderCount = 0

    mockDraftStore.set('file1.txt', 'content1')

    const { result } = renderHook(() => {
      renderCount++
      return useDraft('file1.txt')
    })

    const initialCount = renderCount

    act(() => {
      mockDraftStore.set('file2.txt', 'content2')
    })

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })
})

describe('useHasDraft', () => {
  beforeEach(() => {
    mockDraftStore = new DraftStore()
  })

  it('should return true when draft exists', () => {
    mockDraftStore.set('test.txt', 'content')

    const { result } = renderHook(() => useHasDraft('test.txt'))

    expect(result.current).toBe(true)
  })

  it('should return false when no draft exists', () => {
    const { result } = renderHook(() => useHasDraft('test.txt'))

    expect(result.current).toBe(false)
  })

  it('should re-render when draft is created', async () => {
    const { result } = renderHook(() => useHasDraft('test.txt'))

    expect(result.current).toBe(false)

    act(() => {
      mockDraftStore.set('test.txt', 'content')
    })

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('should re-render when draft is deleted', async () => {
    mockDraftStore.set('test.txt', 'content')

    const { result } = renderHook(() => useHasDraft('test.txt'))

    expect(result.current).toBe(true)

    act(() => {
      mockDraftStore.delete('test.txt')
    })

    await waitFor(() => {
      expect(result.current).toBe(false)
    })
  })
})

describe('useDraftMutations', () => {
  beforeEach(() => {
    mockDraftStore = new DraftStore()
  })

  it('should provide set function', () => {
    const { result } = renderHook(() => useDraftMutations())

    act(() => {
      result.current.set('test.txt', 'content')
    })

    expect(mockDraftStore.get('test.txt')).toBe('content')
  })

  it('should provide delete function', () => {
    mockDraftStore.set('test.txt', 'content')

    const { result } = renderHook(() => useDraftMutations())

    act(() => {
      result.current.delete('test.txt')
    })

    expect(mockDraftStore.has('test.txt')).toBe(false)
  })

  it('should provide clearAll function', () => {
    mockDraftStore.set('a.txt', 'a')
    mockDraftStore.set('b.txt', 'b')

    const { result } = renderHook(() => useDraftMutations())

    act(() => {
      result.current.clearAll()
    })

    expect(mockDraftStore.isEmpty()).toBe(true)
  })

  it('should provide save function', async () => {
    const appFS = new AppFS()
    const saveSpy = vi.spyOn(appFS, 'writeFile')

    mockDraftStore.set('test.txt', 'draft content')

    // Mock the useAppFS hook
    vi.doMock('../fs/useAppFS', () => ({
      useAppFS: () => appFS
    }))

    const { result } = renderHook(() => useDraftMutations())

    await act(async () => {
      await result.current.save('test.txt')
    })

    expect(saveSpy).toHaveBeenCalledWith('test.txt', 'draft content')
    expect(mockDraftStore.has('test.txt')).toBe(false)
  })
})

describe('useUnsavedPaths', () => {
  beforeEach(() => {
    mockDraftStore = new DraftStore()
  })

  it('should return array of draft paths', () => {
    mockDraftStore.set('a.txt', 'a')
    mockDraftStore.set('b.txt', 'b')
    mockDraftStore.set('c.txt', 'c')

    const { result } = renderHook(() => useUnsavedPaths())

    const paths = result.current.sort()

    expect(paths).toEqual(['a.txt', 'b.txt', 'c.txt'])
  })

  it('should return empty array when no drafts', () => {
    const { result } = renderHook(() => useUnsavedPaths())

    expect(result.current).toEqual([])
  })

  it('should re-render when draft is added', async () => {
    const { result } = renderHook(() => useUnsavedPaths())

    expect(result.current).toEqual([])

    act(() => {
      mockDraftStore.set('new.txt', 'new')
    })

    await waitFor(() => {
      expect(result.current).toContain('new.txt')
    })
  })

  it('should re-render when draft is removed', async () => {
    mockDraftStore.set('a.txt', 'a')
    mockDraftStore.set('b.txt', 'b')

    const { result } = renderHook(() => useUnsavedPaths())

    expect(result.current.length).toBe(2)

    act(() => {
      mockDraftStore.delete('a.txt')
    })

    await waitFor(() => {
      expect(result.current).not.toContain('a.txt')
      expect(result.current.length).toBe(1)
    })
  })

  it('should re-render when all drafts are cleared', async () => {
    mockDraftStore.set('a.txt', 'a')
    mockDraftStore.set('b.txt', 'b')

    const { result } = renderHook(() => useUnsavedPaths())

    expect(result.current.length).toBe(2)

    act(() => {
      mockDraftStore.clear()
    })

    await waitFor(() => {
      expect(result.current).toEqual([])
    })
  })
})

function act(fn: () => void) {
  fn()
}
