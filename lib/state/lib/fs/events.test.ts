// src/lib/fs/events.test.ts

import { describe, it, expect } from 'vitest'

describe('FSEvent Types', () => {
  it('should create valid FSEvent', () => {
    const event = {
      type: 'create' as const,
      path: 'test/file.txt',
      content: 'hello',
      timestamp: Date.now()
    }
    expect(event.type).toBe('create')
    expect(event.path).toBe('test/file.txt')
    expect(event.content).toBe('hello')
    expect(typeof event.timestamp).toBe('number')
  })

  it('should create valid FSEvent with oldPath for rename', () => {
    const event = {
      type: 'rename' as const,
      path: 'test/new.txt',
      oldPath: 'test/old.txt',
      content: 'content',
      timestamp: Date.now()
    }
    expect(event.oldPath).toBe('test/old.txt')
  })

  it('should create valid DirEvent', () => {
    const event = {
      type: 'add' as const,
      dir: 'test',
      entry: 'file.txt',
      content: 'hello'
    }
    expect(event.dir).toBe('test')
    expect(event.entry).toBe('file.txt')
  })

  it('should create valid BatchEvent', () => {
    const event = {
      events: [
        { type: 'create' as const, path: 'a.txt', content: 'a', timestamp: 1 },
        { type: 'create' as const, path: 'b.txt', content: 'b', timestamp: 2 }
      ]
    }
    expect(event.events).toHaveLength(2)
  })
})
