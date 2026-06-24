// src/lib/fs/ScopedFS.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { AppFS } from './AppFS'
import { ProjectFS, SpaceFS } from './ScopedFS'

describe('ScopedFS', () => {
  let appFS: AppFS
  let projectFS: ProjectFS
  let spaceFS: SpaceFS

  beforeEach(() => {
    appFS = new AppFS()

    // Set up test data (prefix = projectId/spaceId, no username segment).
    appFS.writeFile('project1/.env', 'SHARED=secret')
    appFS.writeFile('project1/lmthing.json', '{"name": "Project 1"}')
    appFS.writeFile('project1/space1/package.json', '{"name": "space1"}')
    appFS.writeFile('project1/space1/agents/bot/instruct.md', 'Be a bot')
    appFS.writeFile('project1/space1/flows/workflow/index.md', '# Workflow')

    projectFS = new ProjectFS(appFS, 'project1')
    spaceFS = new SpaceFS(appFS, 'project1', 'space1')
  })

  describe('ProjectFS', () => {
    it('should strip projectId prefix from reads', () => {
      const content = projectFS.readFile('lmthing.json')
      expect(content).toBe('{"name": "Project 1"}')
    })

    it('should strip projectId prefix from writes', () => {
      projectFS.writeFile('test.txt', 'content')
      expect(appFS.readFile('project1/test.txt')).toBe('content')
    })

    it('should list immediate children correctly', () => {
      const entries = projectFS.readDir('')
      const names = entries.map((e) => e.name).sort()

      expect(names).toContain('.env')
      expect(names).toContain('lmthing.json')
      expect(names).toContain('space1')
    })

    it('should read project-level directory', () => {
      const entries = projectFS.readDir('space1')
      const names = entries.map((e) => e.name)

      expect(names).toContain('package.json')
      expect(names).toContain('agents')
      expect(names).toContain('flows')
    })
  })

  describe('SpaceFS', () => {
    it('should strip full prefix from reads', () => {
      const content = spaceFS.readFile('package.json')
      expect(content).toBe('{"name": "space1"}')
    })

    it('should strip full prefix from writes', () => {
      spaceFS.writeFile('test.txt', 'content')
      expect(appFS.readFile('project1/space1/test.txt')).toBe('content')
    })

    it('should list space-level contents', () => {
      const entries = spaceFS.readDir('')
      const names = entries.map((e) => e.name).sort()

      expect(names).toContain('package.json')
      expect(names).toContain('agents')
      expect(names).toContain('flows')
    })

    it('should read nested directories', () => {
      const entries = spaceFS.readDir('agents')
      const names = entries.map((e) => e.name)

      expect(names).toContain('bot')
    })

    it('should glob within space scope', () => {
      spaceFS.writeFile('agents/bot2/instruct.md', 'Be bot 2')

      const matches = spaceFS.glob('agents/*/instruct.md')

      expect(matches).toContain('agents/bot/instruct.md')
      expect(matches).toContain('agents/bot2/instruct.md')
      expect(matches).not.toContain('flows/workflow/index.md')
    })
  })

  describe('Event scoping', () => {
    it('should strip prefix from file events', () => {
      let capturedPath: string | null = null
      spaceFS.onFile('agents/bot/instruct.md', (e) => {
        capturedPath = e.path
      })

      appFS.writeFile('project1/space1/agents/bot/instruct.md', 'New content')

      expect(capturedPath).toBe('agents/bot/instruct.md')
    })

    it('should strip prefix from dir events', () => {
      let capturedDir: string | null = null
      spaceFS.onDir('agents', (e) => {
        capturedDir = e.dir
      })

      appFS.writeFile('project1/space1/agents/new-agent.md', 'content')

      expect(capturedDir).toBe('agents')
    })

    it('should only notify for events within scope', () => {
      let callCount = 0
      spaceFS.onAny(() => {
        callCount++
      })

      appFS.writeFile('project1/space1/test.txt', 'a')
      appFS.writeFile('project1/space2/test.txt', 'b')
      appFS.writeFile('project2/space1/test.txt', 'c')

      expect(callCount).toBe(1) // Only space1 file
    })
  })

  describe('onPrefix within scope', () => {
    it('should match relative prefix', () => {
      let callCount = 0
      spaceFS.onPrefix('agents', () => {
        callCount++
      })

      appFS.writeFile('project1/space1/agents/bot/file.txt', 'a')
      appFS.writeFile('project1/space1/flows/workflow/file.txt', 'b')

      expect(callCount).toBe(1)
    })
  })

  describe('onGlob within scope', () => {
    it('should transform pattern and strip results', () => {
      let capturedPath: string | null = null
      spaceFS.onGlob('agents/**/*.md', (e) => {
        capturedPath = e.path
      })

      appFS.writeFile('project1/space1/agents/bot/instruct.md', 'content')

      expect(capturedPath).toBe('agents/bot/instruct.md')
    })
  })

  describe('getSnapshot', () => {
    it('should return scoped snapshot', () => {
      const snapshot = spaceFS.getSnapshot()

      // Should have space-relative keys
      expect(snapshot['package.json']).toBeDefined()
      expect(snapshot['agents/bot/instruct.md']).toBeDefined()

      // Should not have full path keys
      expect(snapshot['project1/space1/package.json']).toBeUndefined()
    })
  })

  describe('fromProjectFS factory', () => {
    it('should create SpaceFS from ProjectFS', () => {
      const space = SpaceFS.fromProjectFS(projectFS, 'space1')

      expect(space.readFile('package.json')).toBe('{"name": "space1"}')
    })
  })

  describe('renamePath within scope', () => {
    it('should rename with scoped paths', () => {
      spaceFS.renamePath('agents/bot', 'agents/ai')

      expect(appFS.readFile('project1/space1/agents/bot/instruct.md')).toBeNull()
      expect(appFS.readFile('project1/space1/agents/ai/instruct.md')).toBe('Be a bot')
    })
  })

  describe('deletePath within scope', () => {
    it('should delete with scoped path', () => {
      spaceFS.deletePath('agents/bot')

      expect(appFS.readFile('project1/space1/agents/bot/instruct.md')).toBeNull()
      expect(appFS.readFile('project1/space1/flows/workflow/index.md')).toBe('# Workflow')
    })
  })

  describe('batch within scope', () => {
    it('should transform all operations', () => {
      spaceFS.batch([
        { type: 'write', path: 'new.txt', content: 'new' },
        { type: 'rename', oldPath: 'agents/bot', newPath: 'agents/ai' },
      ])

      expect(appFS.readFile('project1/space1/new.txt')).toBe('new')
      expect(appFS.readFile('project1/space1/agents/ai/instruct.md')).toBe('Be a bot')
    })
  })

  describe('streaming operations', () => {
    it('should stream write with scoped path', async () => {
      async function* stream() {
        yield 'streamed '
        yield 'content'
      }

      await spaceFS.streamWriteFile('stream.txt', stream())

      expect(appFS.readFile('project1/space1/stream.txt')).toBe('streamed content')
      expect(spaceFS.readFile('stream.txt')).toBe('streamed content')
    })
  })
})
