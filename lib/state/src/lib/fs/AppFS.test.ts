// src/lib/fs/AppFS.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { AppFS } from './AppFS'

describe('AppFS', () => {
  let fs: AppFS

  beforeEach(() => {
    fs = new AppFS()
  })

  describe('readFile', () => {
    it('should return null for non-existent file', () => {
      expect(fs.readFile('non-existent.txt')).toBeNull()
    })

    it('should return content for existing file', () => {
      fs.writeFile('test.txt', 'hello')
      expect(fs.readFile('test.txt')).toBe('hello')
    })
  })

  describe('writeFile', () => {
    it('should create new file', () => {
      fs.writeFile('new.txt', 'content')
      expect(fs.readFile('new.txt')).toBe('content')
    })

    it('should update existing file', () => {
      fs.writeFile('test.txt', 'first')
      fs.writeFile('test.txt', 'second')
      expect(fs.readFile('test.txt')).toBe('second')
    })

    it('should emit create event on first write', () => {
      let capturedEvent: any = null
      fs.onFileCreate('test.txt', (content) => {
        capturedEvent = { type: 'create', content }
      })

      fs.writeFile('test.txt', 'hello')

      expect(capturedEvent).toEqual({ type: 'create', content: 'hello' })
    })

    it('should emit update event on subsequent write', () => {
      fs.writeFile('test.txt', 'first')

      let capturedType: string | null = null
      fs.onFileUpdate('test.txt', () => {
        capturedType = 'update'
      })

      fs.writeFile('test.txt', 'second')

      expect(capturedType).toBe('update')
    })
  })

  describe('appendFile', () => {
    it('should append to existing file', () => {
      fs.writeFile('test.txt', 'hello')
      fs.appendFile('test.txt', ' world')
      expect(fs.readFile('test.txt')).toBe('hello world')
    })

    it('should create file if not exists', () => {
      fs.appendFile('new.txt', 'content')
      expect(fs.readFile('new.txt')).toBe('content')
    })
  })

  describe('deleteFile', () => {
    it('should delete existing file', () => {
      fs.writeFile('test.txt', 'content')
      fs.deleteFile('test.txt')
      expect(fs.readFile('test.txt')).toBeNull()
    })

    it('should emit delete event', () => {
      fs.writeFile('test.txt', 'content')

      let deleted = false
      fs.onFileDelete('test.txt', () => {
        deleted = true
      })

      fs.deleteFile('test.txt')

      expect(deleted).toBe(true)
    })

    it('should do nothing for non-existent file', () => {
      expect(() => fs.deleteFile('non-existent.txt')).not.toThrow()
    })
  })

  describe('readDir', () => {
    beforeEach(() => {
      fs.writeFile('dir/file1.txt', 'a')
      fs.writeFile('dir/file2.txt', 'b')
      fs.writeFile('dir/nested/file3.txt', 'c')
    })

    it('should list immediate children', () => {
      const entries = fs.readDir('dir')
      const names = entries.map(e => e.name).sort()

      expect(names).toEqual(['file1.txt', 'file2.txt', 'nested'])
    })

    it('should mark entry types correctly', () => {
      const entries = fs.readDir('dir')

      const file = entries.find(e => e.name === 'file1.txt')
      expect(file?.type).toBe('file')

      const nested = entries.find(e => e.name === 'nested')
      expect(nested?.type).toBe('dir')
    })

    it('should return empty array for non-existent directory', () => {
      expect(fs.readDir('non-existent')).toEqual([])
    })

    it('should list root directory', () => {
      fs.writeFile('root.txt', 'root')
      const entries = fs.readDir('')
      expect(entries.some(e => e.name === 'dir')).toBe(true)
      expect(entries.some(e => e.name === 'root.txt')).toBe(true)
    })
  })

  describe('glob', () => {
    beforeEach(() => {
      fs.writeFile('src/file1.txt', 'a')
      fs.writeFile('src/file2.md', 'b')
      fs.writeFile('src/nested/file3.txt', 'c')
      fs.writeFile('test/file4.txt', 'd')
    })

    it('should match * pattern (non-recursive)', () => {
      const matches = fs.glob('src/*.txt').sort()
      expect(matches).toEqual(['src/file1.txt'])
    })

    it('should match ** pattern (recursive)', () => {
      const matches = fs.glob('src/**/*.txt').sort()
      expect(matches).toEqual(['src/file1.txt', 'src/nested/file3.txt'])
    })

    it('should match ? pattern (single char)', () => {
      const matches = fs.glob('src/file?.txt').sort()
      expect(matches).toEqual(['src/file1.txt'])
    })

    it('should match character classes', () => {
      const matches = fs.glob('src/file[12].txt').sort()
      expect(matches).toEqual(['src/file1.txt'])
    })

    it('should match extglob patterns', () => {
      const matches = fs.glob('src/*.@(txt|md)').sort()
      expect(matches).toEqual(['src/file1.txt', 'src/file2.md'])
    })

    it('should match negated patterns', () => {
      const matches = fs.glob('!src/**/*.md').sort()
      expect(matches).toContain('src/file1.txt')
      expect(matches).not.toContain('src/file2.md')
    })
  })

  describe('globRead', () => {
    it('should return matched files with content', () => {
      fs.writeFile('a.txt', 'content a')
      fs.writeFile('b.txt', 'content b')

      const result = fs.globRead('*.txt')

      expect(Object.keys(result).length).toBeGreaterThanOrEqual(2)
      expect(result['a.txt']).toBe('content a')
      expect(result['b.txt']).toBe('content b')
    })
  })

  describe('deletePath', () => {
    it('should delete directory and all contents', () => {
      fs.writeFile('dir/file1.txt', 'a')
      fs.writeFile('dir/nested/file2.txt', 'b')

      fs.deletePath('dir')

      expect(fs.readFile('dir/file1.txt')).toBeNull()
      expect(fs.readFile('dir/nested/file2.txt')).toBeNull()
    })

    it('should emit delete events for all files', () => {
      fs.writeFile('dir/file1.txt', 'a')
      fs.writeFile('dir/file2.txt', 'b')

      const deleted: string[] = []
      fs.onAny((e) => {
        if (e.type === 'delete') deleted.push(e.path)
      })

      fs.deletePath('dir')

      expect(deleted).toContain('dir/file1.txt')
      expect(deleted).toContain('dir/file2.txt')
    })
  })

  describe('renamePath', () => {
    it('should rename file', () => {
      fs.writeFile('old.txt', 'content')
      fs.renamePath('old.txt', 'new.txt')

      expect(fs.readFile('old.txt')).toBeNull()
      expect(fs.readFile('new.txt')).toBe('content')
    })

    it('should rename directory and all contents', () => {
      fs.writeFile('old/file.txt', 'content')
      fs.writeFile('old/nested/file2.txt', 'content2')

      fs.renamePath('old', 'new')

      expect(fs.readFile('old/file.txt')).toBeNull()
      expect(fs.readFile('new/file.txt')).toBe('content')
      expect(fs.readFile('new/nested/file2.txt')).toBe('content2')
    })

    it('should emit rename events', () => {
      fs.writeFile('old.txt', 'content')

      let renamedPath: string | null = null
      fs.onFileRename('old.txt', (newPath) => {
        renamedPath = newPath
      })

      fs.renamePath('old.txt', 'new.txt')

      expect(renamedPath).toBe('new.txt')
    })
  })

  describe('duplicatePath', () => {
    it('should duplicate file', () => {
      fs.writeFile('source.txt', 'content')
      fs.duplicatePath('source.txt', 'dest.txt')

      expect(fs.readFile('source.txt')).toBe('content')
      expect(fs.readFile('dest.txt')).toBe('content')
    })

    it('should duplicate directory and all contents', () => {
      fs.writeFile('source/file.txt', 'content')

      fs.duplicatePath('source', 'dest')

      expect(fs.readFile('source/file.txt')).toBe('content')
      expect(fs.readFile('dest/file.txt')).toBe('content')
    })
  })

  describe('batch', () => {
    it('should execute multiple operations', () => {
      fs.batch([
        { type: 'write', path: 'a.txt', content: 'a' },
        { type: 'write', path: 'b.txt', content: 'b' },
        { type: 'delete', path: 'a.txt' }
      ])

      expect(fs.readFile('a.txt')).toBeNull()
      expect(fs.readFile('b.txt')).toBe('b')
    })

    it('should fire batch event once', () => {
      let batchCount = 0
      fs.onBatch(() => {
        batchCount++
      })

      fs.batch([
        { type: 'write', path: 'a.txt', content: 'a' },
        { type: 'write', path: 'b.txt', content: 'b' }
      ])

      expect(batchCount).toBe(1)
    })
  })

  describe('streamWriteFile', () => {
    it('should write async stream to file', async () => {
      async function* stream() {
        yield 'hello '
        yield 'world'
      }

      await fs.streamWriteFile('test.txt', stream())

      expect(fs.readFile('test.txt')).toBe('hello world')
    })
  })

  describe('streamAppendFile', () => {
    it('should append async stream to file', async () => {
      fs.writeFile('test.txt', 'hello ')

      async function* stream() {
        yield 'world'
      }

      await fs.streamAppendFile('test.txt', stream())

      expect(fs.readFile('test.txt')).toBe('hello world')
    })
  })

  describe('export/import', () => {
    it('should export all files', () => {
      fs.writeFile('a.txt', 'content a')
      fs.writeFile('b.txt', 'content b')

      const exported = fs.export()

      expect(exported['a.txt']).toBe('content a')
      expect(exported['b.txt']).toBe('content b')
    })

    it('should import files', () => {
      const data = {
        'imported.txt': 'imported content',
        'nested/file.txt': 'nested content'
      }

      fs.import(data)

      expect(fs.readFile('imported.txt')).toBe('imported content')
      expect(fs.readFile('nested/file.txt')).toBe('nested content')
    })

    it('should clear existing data on import', () => {
      fs.writeFile('old.txt', 'old')

      fs.import({ 'new.txt': 'new' })

      expect(fs.readFile('old.txt')).toBeNull()
      expect(fs.readFile('new.txt')).toBe('new')
    })
  })

  describe('getSnapshot', () => {
    it('should return readonly snapshot', () => {
      fs.writeFile('test.txt', 'content')

      const snapshot = fs.getSnapshot()

      expect(snapshot['test.txt']).toBe('content')
      // Should be a new object, not the internal map
      expect(snapshot).not.toBe(fs.getSnapshot())
    })
  })

  describe('subscribe', () => {
    it('should call callback on any change', () => {
      let callCount = 0
      const unsubscribe = fs.subscribe(() => {
        callCount++
      })

      fs.writeFile('a.txt', 'a')
      fs.writeFile('b.txt', 'b')

      expect(callCount).toBe(2)

      unsubscribe()
    })

    it('should stop calling after unsubscribe', () => {
      let callCount = 0
      const unsubscribe = fs.subscribe(() => {
        callCount++
      })

      fs.writeFile('a.txt', 'a')
      unsubscribe()
      fs.writeFile('b.txt', 'b')

      expect(callCount).toBe(1)
    })
  })
})
