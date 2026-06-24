// src/hooks/useDraft.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { DraftStore } from '@/lib/fs/DraftStore'
import { AppFS } from '@/lib/fs/AppFS'
import { createTestWrapper } from '@/test-utils'
import { useDraft, useHasDraft, useDraftMutations, useUnsavedPaths } from './useDraft'

describe('useDraft', () => {
  let drafts: DraftStore

  beforeEach(() => {
    drafts = new DraftStore()
  })

  it('should return draft content when draft exists', () => {
    drafts.set('test.txt', 'draft content')

    const { result } = renderHook(() => useDraft('test.txt'), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    expect(result.current).toBe('draft content')
  })

  it('should return undefined when no draft exists', () => {
    const { result } = renderHook(() => useDraft('non-existent.txt'), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    expect(result.current).toBeUndefined()
  })

  it('should re-render when draft is set', async () => {
    const { result } = renderHook(() => useDraft('test.txt'), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    expect(result.current).toBeUndefined()

    act(() => {
      drafts.set('test.txt', 'new draft')
    })

    await waitFor(() => {
      expect(result.current).toBe('new draft')
    })
  })

  it('should re-render when draft is deleted', async () => {
    drafts.set('test.txt', 'content')

    const { result } = renderHook(() => useDraft('test.txt'), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    expect(result.current).toBe('content')

    act(() => {
      drafts.delete('test.txt')
    })

    await waitFor(() => {
      expect(result.current).toBeUndefined()
    })
  })

  it('should not re-render when different draft changes', async () => {
    let renderCount = 0
    drafts.set('file1.txt', 'content1')

    const { result } = renderHook(
      () => {
        renderCount++
        return useDraft('file1.txt')
      },
      {
        wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
      },
    )

    const initialCount = renderCount

    act(() => {
      drafts.set('file2.txt', 'content2')
    })

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })
})

describe('useHasDraft', () => {
  let drafts: DraftStore

  beforeEach(() => {
    drafts = new DraftStore()
  })

  it('should return true when draft exists', () => {
    drafts.set('test.txt', 'content')

    const { result } = renderHook(() => useHasDraft('test.txt'), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    expect(result.current).toBe(true)
  })

  it('should return false when no draft exists', () => {
    const { result } = renderHook(() => useHasDraft('test.txt'), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    expect(result.current).toBe(false)
  })

  it('should re-render when draft is created', async () => {
    const { result } = renderHook(() => useHasDraft('test.txt'), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    expect(result.current).toBe(false)

    act(() => {
      drafts.set('test.txt', 'content')
    })

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('should re-render when draft is deleted', async () => {
    drafts.set('test.txt', 'content')

    const { result } = renderHook(() => useHasDraft('test.txt'), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    expect(result.current).toBe(true)

    act(() => {
      drafts.delete('test.txt')
    })

    await waitFor(() => {
      expect(result.current).toBe(false)
    })
  })
})

describe('useDraftMutations', () => {
  let drafts: DraftStore

  beforeEach(() => {
    drafts = new DraftStore()
  })

  it('should provide set function', () => {
    const { result } = renderHook(() => useDraftMutations(), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    act(() => {
      result.current.set('test.txt', 'content')
    })

    expect(drafts.get('test.txt')).toBe('content')
  })

  it('should provide delete function', () => {
    drafts.set('test.txt', 'content')

    const { result } = renderHook(() => useDraftMutations(), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    act(() => {
      result.current.delete('test.txt')
    })

    expect(drafts.has('test.txt')).toBe(false)
  })

  it('should provide clearAll function', () => {
    drafts.set('a.txt', 'a')
    drafts.set('b.txt', 'b')

    const { result } = renderHook(() => useDraftMutations(), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    act(() => {
      result.current.clearAll()
    })

    expect(drafts.isEmpty()).toBe(true)
  })
})

describe('useUnsavedPaths', () => {
  let drafts: DraftStore

  beforeEach(() => {
    drafts = new DraftStore()
  })

  it('should return array of draft paths', () => {
    drafts.set('a.txt', 'a')
    drafts.set('b.txt', 'b')
    drafts.set('c.txt', 'c')

    const { result } = renderHook(() => useUnsavedPaths(), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    const paths = result.current.sort()

    expect(paths).toEqual(['a.txt', 'b.txt', 'c.txt'])
  })

  it('should return empty array when no drafts', () => {
    const { result } = renderHook(() => useUnsavedPaths(), {
      wrapper: createTestWrapper(new AppFS(), { draftStore: drafts } as any),
    })

    expect(result.current).toEqual([])
  })
})
