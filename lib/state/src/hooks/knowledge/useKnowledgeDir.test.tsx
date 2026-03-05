// src/hooks/knowledge/useKnowledgeDir.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../../lib/contexts/AppContext'
import { StudioProvider } from '../../lib/contexts/StudioContext'
import { SpaceProvider } from '../../lib/contexts/SpaceContext'
import { AppFS } from '../../lib/fs/AppFS'
import { useKnowledgeDir } from './useKnowledgeDir'

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

describe('useKnowledgeDir', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should list knowledge domain contents', () => {
    appFS.writeFile('alice/test/space1/knowledge/engineering/config.json', '{}')
    appFS.writeFile('alice/test/space1/knowledge/engineering/guide.md', '# Guide')
    appFS.writeFile('alice/test/space1/knowledge/engineering/reference.md', '# Reference')

    const { result } = renderHook(() => useKnowledgeDir('engineering'), {
      wrapper: createWrapper(appFS)
    })

    const names = result.current.map(e => e.name).sort()

    expect(names).toContain('config.json')
    expect(names).toContain('guide.md')
    expect(names).toContain('reference.md')
  })

  it('should return entry types correctly', () => {
    appFS.writeFile('alice/test/space1/knowledge/domain/config.json', '{}')
    appFS.writeFile('alice/test/space1/knowledge/domain/file.md', '# File')
    appFS.writeFile('alice/test/space1/knowledge/domain/subdir/nested.md', '# Nested')

    const { result } = renderHook(() => useKnowledgeDir('domain'), {
      wrapper: createWrapper(appFS)
    })

    const files = result.current.filter(e => e.type === 'file')
    const dirs = result.current.filter(e => e.type === 'dir')

    expect(files.length).toBeGreaterThan(0)
    expect(dirs.some(d => d.name === 'subdir')).toBe(true)
  })

  it('should return empty array for non-existent domain', () => {
    const { result } = renderHook(() => useKnowledgeDir('non-existent'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toEqual([])
  })

  it('should re-render when file is added', async () => {
    appFS.writeFile('alice/test/space1/knowledge/domain/config.json', '{}')

    const { result } = renderHook(() => useKnowledgeDir('domain'), {
      wrapper: createWrapper(appFS)
    })

    const initialCount = result.current.length

    appFS.writeFile('alice/test/space1/knowledge/domain/newfile.md', '# New')

    await waitFor(() => {
      expect(result.current.length).toBe(initialCount + 1)
    })
  })

  it('should re-render when file is deleted', async () => {
    appFS.writeFile('alice/test/space1/knowledge/domain/file.md', '# File')

    const { result } = renderHook(() => useKnowledgeDir('domain'), {
      wrapper: createWrapper(appFS)
    })

    const initialCount = result.current.length

    appFS.deleteFile('alice/test/space1/knowledge/domain/file.md')

    await waitFor(() => {
      expect(result.current.length).toBeLessThan(initialCount)
    })
  })

  it('should not re-render when different domain changes', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/knowledge/domain1/config.json', '{}')
    appFS.writeFile('alice/test/space1/knowledge/domain2/config.json', '{}')

    const { result } = renderHook(() => {
      renderCount++
      return useKnowledgeDir('domain1')
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile('alice/test/space1/knowledge/domain2/newfile.md', '# New')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle domains with many files', () => {
    for (let i = 0; i < 100; i++) {
      appFS.writeFile(`alice/test/space1/knowledge/large/file${i}.md`, `# File ${i}`)
    }

    const { result } = renderHook(() => useKnowledgeDir('large'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.length).toBeGreaterThanOrEqual(100)
  })

  it('should handle nested subdirectories', () => {
    appFS.writeFile('alice/test/space1/knowledge/domain/a/b/c/file.md', '# Deep')

    const { result } = renderHook(() => useKnowledgeDir('domain'), {
      wrapper: createWrapper(appFS)
    })

    // Should see 'a' as a directory
    const aDir = result.current.find(e => e.name === 'a')
    expect(aDir?.type).toBe('dir')
  })

  it('should handle domain with special characters in ID', () => {
    appFS.writeFile('alice/test/space1/knowledge/my-domain_123/config.json', '{}')

    const { result } = renderHook(() => useKnowledgeDir('my-domain_123'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current.some(e => e.name === 'config.json')).toBe(true)
  })
})
