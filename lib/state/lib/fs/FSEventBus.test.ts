// src/lib/fs/FSEventBus.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FSEventBus } from './FSEventBus'
import type { FSEvent } from './events'

describe('FSEventBus', () => {
  let bus: FSEventBus

  beforeEach(() => {
    bus = new FSEventBus()
  })

  describe('onAny', () => {
    it('should fire for all events', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onAny(cb)

      bus.emit({ type: 'create', path: 'a.txt', content: 'a', timestamp: 1 })
      bus.emit({ type: 'update', path: 'a.txt', content: 'b', timestamp: 2 })
      bus.emit({ type: 'delete', path: 'a.txt', timestamp: 3 })

      expect(cb).toHaveBeenCalledTimes(3)
      unsubscribe()
    })

    it('should stop firing after unsubscribe', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onAny(cb)

      bus.emit({ type: 'create', path: 'a.txt', content: 'a', timestamp: 1 })
      unsubscribe()
      bus.emit({ type: 'create', path: 'b.txt', content: 'b', timestamp: 2 })

      expect(cb).toHaveBeenCalledTimes(1)
    })
  })

  describe('onFile', () => {
    it('should fire only for specific file', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onFile('test/file.txt', cb)

      bus.emit({ type: 'create', path: 'test/file.txt', content: 'a', timestamp: 1 })
      bus.emit({ type: 'create', path: 'other/file.txt', content: 'b', timestamp: 2 })

      expect(cb).toHaveBeenCalledTimes(1)
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ path: 'test/file.txt' }))
      unsubscribe()
    })
  })

  describe('onFileCreate', () => {
    it('should fire only on create', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onFileCreate('test/file.txt', cb)

      bus.emit({ type: 'create', path: 'test/file.txt', content: 'a', timestamp: 1 })
      bus.emit({ type: 'update', path: 'test/file.txt', content: 'b', timestamp: 2 })
      bus.emit({ type: 'delete', path: 'test/file.txt', timestamp: 3 })

      expect(cb).toHaveBeenCalledTimes(1)
      expect(cb).toHaveBeenCalledWith('a')
      unsubscribe()
    })
  })

  describe('onFileUpdate', () => {
    it('should fire only on update', () => {
      const cb = vi.fn()
      bus.writeFile = vi.fn() // Mock if needed

      const unsubscribe = bus.onFileUpdate('test/file.txt', cb)

      bus.emit({ type: 'create', path: 'test/file.txt', content: 'a', timestamp: 1 })
      bus.emit({ type: 'update', path: 'test/file.txt', content: 'b', timestamp: 2 })
      bus.emit({ type: 'delete', path: 'test/file.txt', timestamp: 3 })

      expect(cb).toHaveBeenCalledTimes(1)
      expect(cb).toHaveBeenCalledWith('b')
      unsubscribe()
    })
  })

  describe('onFileDelete', () => {
    it('should fire on delete', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onFileDelete('test/file.txt', cb)

      bus.emit({ type: 'delete', path: 'test/file.txt', timestamp: 1 })

      expect(cb).toHaveBeenCalledTimes(1)
      unsubscribe()
    })
  })

  describe('onFileRename', () => {
    it('should fire on rename with new path', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onFileRename('test/old.txt', cb)

      bus.emit({
        type: 'rename',
        path: 'test/new.txt',
        oldPath: 'test/old.txt',
        content: 'a',
        timestamp: 1
      })

      expect(cb).toHaveBeenCalledTimes(1)
      expect(cb).toHaveBeenCalledWith('test/new.txt')
      unsubscribe()
    })
  })

  describe('onDir', () => {
    it('should fire for changes in directory', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onDir('test', cb)

      bus.emit({ type: 'create', path: 'test/file.txt', content: 'a', timestamp: 1 })
      bus.emit({ type: 'create', path: 'other/file.txt', content: 'b', timestamp: 2 })

      expect(cb).toHaveBeenCalledTimes(1)
      unsubscribe()
    })

    it('should not fire for nested directories', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onDir('test', cb)

      bus.emit({ type: 'create', path: 'test/nested/file.txt', content: 'a', timestamp: 1 })

      expect(cb).not.toHaveBeenCalled()
      unsubscribe()
    })
  })

  describe('onDirAdd', () => {
    it('should fire when file is added to directory', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onDirAdd('test', cb)

      bus.emit({ type: 'create', path: 'test/file.txt', content: 'hello', timestamp: 1 })

      expect(cb).toHaveBeenCalledTimes(1)
      expect(cb).toHaveBeenCalledWith('file.txt', 'hello')
      unsubscribe()
    })
  })

  describe('onDirRemove', () => {
    it('should fire when file is removed from directory', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onDirRemove('test', cb)

      bus.emit({ type: 'delete', path: 'test/file.txt', timestamp: 1 })

      expect(cb).toHaveBeenCalledTimes(1)
      expect(cb).toHaveBeenCalledWith('file.txt')
      unsubscribe()
    })
  })

  describe('onDirRename', () => {
    it('should fire when file in directory is renamed', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onDirRename('test', cb)

      bus.emit({
        type: 'rename',
        path: 'test/new.txt',
        oldPath: 'test/old.txt',
        content: 'a',
        timestamp: 1
      })

      expect(cb).toHaveBeenCalledTimes(1)
      expect(cb).toHaveBeenCalledWith('old.txt', 'new.txt')
      unsubscribe()
    })
  })

  describe('onPrefix', () => {
    it('should fire for all events under prefix', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onPrefix('test', cb)

      bus.emit({ type: 'create', path: 'test/file.txt', content: 'a', timestamp: 1 })
      bus.emit({ type: 'create', path: 'test/nested/file.txt', content: 'b', timestamp: 2 })
      bus.emit({ type: 'create', path: 'other/file.txt', content: 'c', timestamp: 3 })

      expect(cb).toHaveBeenCalledTimes(2)
      unsubscribe()
    })
  })

  describe('onGlob', () => {
    it('should fire for matching paths', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onGlob('test/*.txt', cb)

      bus.emit({ type: 'create', path: 'test/file.txt', content: 'a', timestamp: 1 })
      bus.emit({ type: 'create', path: 'test/nested/file.txt', content: 'b', timestamp: 2 })
      bus.emit({ type: 'create', path: 'other/file.txt', content: 'c', timestamp: 3 })

      expect(cb).toHaveBeenCalledTimes(1)
      unsubscribe()
    })

    it('should support ** patterns', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onGlob('test/**/*.txt', cb)

      bus.emit({ type: 'create', path: 'test/file.txt', content: 'a', timestamp: 1 })
      bus.emit({ type: 'create', path: 'test/nested/file.txt', content: 'b', timestamp: 2 })

      expect(cb).toHaveBeenCalledTimes(2)
      unsubscribe()
    })
  })

  describe('onBatch', () => {
    it('should fire once after emitBatch', () => {
      const cb = vi.fn()
      const unsubscribe = bus.onBatch(cb)

      const events = [
        { type: 'create' as const, path: 'a.txt', content: 'a', timestamp: 1 },
        { type: 'create' as const, path: 'b.txt', content: 'b', timestamp: 2 }
      ]

      bus.emitBatch(events)

      expect(cb).toHaveBeenCalledTimes(1)
      expect(cb).toHaveBeenCalledWith({ events })
      unsubscribe()
    })

    it('should aggregate events during batch()', async () => {
      const batchCb = vi.fn()
      const anyCb = vi.fn()
      bus.onBatch(batchCb)
      bus.onAny(anyCb)

      await bus.batch(async () => {
        bus.emit({ type: 'create', path: 'a.txt', content: 'a', timestamp: 1 })
        bus.emit({ type: 'create', path: 'b.txt', content: 'b', timestamp: 2 })
      })

      // onAny should fire twice (per event)
      expect(anyCb).toHaveBeenCalledTimes(2)

      // onBatch should fire once at the end
      expect(batchCb).toHaveBeenCalledTimes(1)
      expect(batchCb).toHaveBeenCalledWith(expect.objectContaining({
        events: expect.any(Array)
      }))
    })
  })
})
