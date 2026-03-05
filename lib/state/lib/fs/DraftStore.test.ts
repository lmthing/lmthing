// src/lib/fs/DraftStore.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { DraftStore } from './DraftStore'

describe('DraftStore', () => {
  let store: DraftStore

  beforeEach(() => {
    store = new DraftStore()
  })

  describe('set', () => {
    it('should add a new draft', () => {
      store.set('test.txt', 'draft content')

      expect(store.get('test.txt')).toBe('draft content')
      expect(store.has('test.txt')).toBe(true)
    })

    it('should update existing draft', () => {
      store.set('test.txt', 'first')
      store.set('test.txt', 'second')

      expect(store.get('test.txt')).toBe('second')
    })

    it('should emit change event on new draft', () => {
      let captured: any = null
      store.onChange('test.txt', (hasDraft) => {
        captured = { path: 'test.txt', hasDraft }
      })

      store.set('test.txt', 'content')

      expect(captured).toEqual({ path: 'test.txt', hasDraft: true })
    })

    it('should emit subscribe event', () => {
      let callCount = 0
      store.subscribe(() => {
        callCount++
      })

      store.set('test.txt', 'content')

      expect(callCount).toBe(1)
    })
  })

  describe('get', () => {
    it('should return undefined for non-existent draft', () => {
      expect(store.get('non-existent.txt')).toBeUndefined()
    })

    it('should return draft content', () => {
      store.set('test.txt', 'content')
      expect(store.get('test.txt')).toBe('content')
    })
  })

  describe('has', () => {
    it('should return false for non-existent draft', () => {
      expect(store.has('test.txt')).toBe(false)
    })

    it('should return true for existing draft', () => {
      store.set('test.txt', 'content')
      expect(store.has('test.txt')).toBe(true)
    })
  })

  describe('delete', () => {
    it('should remove draft', () => {
      store.set('test.txt', 'content')
      store.delete('test.txt')

      expect(store.has('test.txt')).toBe(false)
      expect(store.get('test.txt')).toBeUndefined()
    })

    it('should emit change event on delete', () => {
      store.set('test.txt', 'content')

      let captured: any = null
      store.onChange('test.txt', (hasDraft) => {
        captured = { path: 'test.txt', hasDraft }
      })

      store.delete('test.txt')

      expect(captured).toEqual({ path: 'test.txt', hasDraft: false })
    })

    it('should do nothing for non-existent draft', () => {
      expect(() => store.delete('non-existent')).not.toThrow()
    })
  })

  describe('clear', () => {
    it('should remove all drafts', () => {
      store.set('a.txt', 'a')
      store.set('b.txt', 'b')
      store.set('c.txt', 'c')

      store.clear()

      expect(store.getCount()).toBe(0)
      expect(store.has('a.txt')).toBe(false)
      expect(store.has('b.txt')).toBe(false)
      expect(store.has('c.txt')).toBe(false)
    })

    it('should emit change events for each deleted path', () => {
      store.set('a.txt', 'a')
      store.set('b.txt', 'b')

      const deleted: string[] = []
      store.onChange('a.txt', () => deleted.push('a'))
      store.onChange('b.txt', () => deleted.push('b'))

      store.clear()

      expect(deleted).toContain('a')
      expect(deleted).toContain('b')
    })

    it('should emit subscribe event once', () => {
      store.set('a.txt', 'a')
      store.set('b.txt', 'b')

      let callCount = 0
      store.subscribe(() => {
        callCount++
      })

      store.clear()

      expect(callCount).toBe(1)
    })

    it('should do nothing when already empty', () => {
      expect(() => store.clear()).not.toThrow()
      expect(store.getCount()).toBe(0)
    })
  })

  describe('getAll', () => {
    it('should return copy of drafts map', () => {
      store.set('a.txt', 'a')
      store.set('b.txt', 'b')

      const all = store.getAll()

      expect(all.get('a.txt')).toBe('a')
      expect(all.get('b.txt')).toBe('b')

      // Modifying returned map shouldn't affect store
      all.set('c.txt', 'c')
      expect(store.has('c.txt')).toBe(false)
    })
  })

  describe('getPaths', () => {
    it('should return array of draft paths', () => {
      store.set('a.txt', 'a')
      store.set('b.txt', 'b')

      const paths = store.getPaths().sort()

      expect(paths).toEqual(['a.txt', 'b.txt'])
    })

    it('should return empty array when no drafts', () => {
      expect(store.getPaths()).toEqual([])
    })
  })

  describe('isEmpty', () => {
    it('should return true when empty', () => {
      expect(store.isEmpty()).toBe(true)
    })

    it('should return false when has drafts', () => {
      store.set('test.txt', 'content')
      expect(store.isEmpty()).toBe(false)
    })

    it('should return true after clearing', () => {
      store.set('test.txt', 'content')
      store.clear()
      expect(store.isEmpty()).toBe(true)
    })
  })

  describe('getCount', () => {
    it('should return number of drafts', () => {
      expect(store.getCount()).toBe(0)

      store.set('a.txt', 'a')
      expect(store.getCount()).toBe(1)

      store.set('b.txt', 'b')
      expect(store.getCount()).toBe(2)
    })

    it('should decrease after delete', () => {
      store.set('a.txt', 'a')
      store.set('b.txt', 'b')

      store.delete('a.txt')

      expect(store.getCount()).toBe(1)
    })
  })

  describe('onChange', () => {
    it('should call callback when draft changes', () => {
      let callCount = 0
      store.onChange('test.txt', () => {
        callCount++
      })

      store.set('test.txt', 'a')
      store.set('test.txt', 'b')

      expect(callCount).toBe(2)
    })

    it('should not call for other paths', () => {
      let called = false
      store.onChange('a.txt', () => {
        called = true
      })

      store.set('b.txt', 'content')

      expect(called).toBe(false)
    })

    it('should return unsubscribe function', () => {
      let callCount = 0
      const unsubscribe = store.onChange('test.txt', () => {
        callCount++
      })

      store.set('test.txt', 'a')
      unsubscribe()
      store.set('test.txt', 'b')

      expect(callCount).toBe(1)
    })
  })

  describe('subscribe', () => {
    it('should return current snapshot in getSnapshot', () => {
      store.set('a.txt', 'a')
      store.set('b.txt', 'b')

      const snapshot = store.getSnapshot()

      expect(snapshot['a.txt']).toBe('a')
      expect(snapshot['b.txt']).toBe('b')
    })

    it('should return new snapshot after changes', () => {
      store.set('a.txt', 'a')

      const snapshot1 = store.getSnapshot()

      store.set('a.txt', 'updated')

      const snapshot2 = store.getSnapshot()

      expect(snapshot1['a.txt']).toBe('a')
      expect(snapshot2['a.txt']).toBe('updated')
    })

    it('should support multiple subscribers', () => {
      let count1 = 0
      let count2 = 0

      store.subscribe(() => count1++)
      store.subscribe(() => count2++)

      store.set('test.txt', 'content')

      expect(count1).toBe(1)
      expect(count2).toBe(1)
    })
  })
})
