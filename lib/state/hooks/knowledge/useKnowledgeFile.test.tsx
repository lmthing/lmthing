// src/hooks/knowledge/useKnowledgeFile.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../../../lib/contexts/AppContext'
import { StudioProvider } from '../../../lib/contexts/StudioContext'
import { SpaceProvider } from '../../../lib/contexts/SpaceContext'
import { AppFS } from '../../../lib/fs/AppFS'
import { useKnowledgeFile } from './useKnowledgeFile'

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

describe('useKnowledgeFile', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should read knowledge file content', () => {
    const content = '# Engineering Guide\n\nThis is a guide.'
    appFS.writeFile('alice/test/space1/knowledge/engineering.md', content)

    const { result } = renderHook(() => useKnowledgeFile('engineering'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBe(content)
  })

  it('should return null for non-existent file', () => {
    const { result } = renderHook(() => useKnowledgeFile('non-existent'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should handle markdown content', () => {
    const content = `# Title

## Section 1

Content here.

## Section 2

More content.`

    appFS.writeFile('alice/test/space1/knowledge/guide.md', content)

    const { result } = renderHook(() => useKnowledgeFile('guide'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toContain('# Title')
    expect(result.current).toContain('## Section 1')
  })

  it('should re-render when file is updated', async () => {
    const initialContent = '# Original'
    appFS.writeFile('alice/test/space1/knowledge/file.md', initialContent)

    const { result } = renderHook(() => useKnowledgeFile('file'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBe(initialContent)

    const updatedContent = '# Updated'
    appFS.writeFile('alice/test/space1/knowledge/file.md', updatedContent)

    await waitFor(() => {
      expect(result.current).toBe(updatedContent)
    })
  })

  it('should re-render when file is created', async () => {
    const { result } = renderHook(() => useKnowledgeFile('newfile'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()

    const content = '# New File'
    appFS.writeFile('alice/test/space1/knowledge/newfile.md', content)

    await waitFor(() => {
      expect(result.current).toBe(content)
    })
  })

  it('should re-render when file is deleted', async () => {
    const content = '# Content'
    appFS.writeFile('alice/test/space1/knowledge/file.md', content)

    const { result } = renderHook(() => useKnowledgeFile('file'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile('alice/test/space1/knowledge/file.md')

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when different file changes', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/knowledge/file1.md', 'content1')
    appFS.writeFile('alice/test/space1/knowledge/file2.md', 'content2')

    const { result } = renderHook(() => {
      renderCount++
      return useKnowledgeFile('file1')
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile('alice/test/space1/knowledge/file2.md', 'updated')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle files with special characters in name', () => {
    const content = '# My File'
    appFS.writeFile('alice/test/space1/knowledge/my-file_123.md', content)

    const { result } = renderHook(() => useKnowledgeFile('my-file_123'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBe(content)
  })

  it('should handle files with nested paths', () => {
    const content = '# Nested File'
    appFS.writeFile('alice/test/space1/knowledge/domain/subdirectory/file.md', content)

    const { result } = renderHook(() => useKnowledgeFile('domain/subdirectory/file'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBe(content)
  })

  it('should handle empty content', () => {
    appFS.writeFile('alice/test/space1/knowledge/empty.md', '')

    const { result } = renderHook(() => useKnowledgeFile('empty'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBe('')
  })
})
