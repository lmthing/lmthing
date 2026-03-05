// src/hooks/knowledge/useKnowledgeFile.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '@/lib/fs/AppFS'
import { createTestWrapper, getTestPath } from '@/test-utils'
import { useKnowledgeFile } from './useKnowledgeFile'

describe('useKnowledgeFile', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should read knowledge file content', () => {
    const content = '# Engineering Guide\n\nThis is a guide.'
    appFS.writeFile(getTestPath('knowledge/engineering.md'), content)

    const { result } = renderHook(() => useKnowledgeFile('engineering'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBe(content)
  })

  it('should return null for non-existent file', () => {
    const { result } = renderHook(() => useKnowledgeFile('non-existent'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should handle markdown content', () => {
    const content = `# Title

## Section 1

Content here.

## Section 2

More content.`

    appFS.writeFile(getTestPath('knowledge/guide.md'), content)

    const { result } = renderHook(() => useKnowledgeFile('guide'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toContain('# Title')
    expect(result.current).toContain('## Section 1')
  })

  it('should re-render when file is updated', async () => {
    const initialContent = '# Original'
    appFS.writeFile(getTestPath('knowledge/file.md'), initialContent)

    const { result } = renderHook(() => useKnowledgeFile('file'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBe(initialContent)

    const updatedContent = '# Updated'
    appFS.writeFile(getTestPath('knowledge/file.md'), updatedContent)

    await waitFor(() => {
      expect(result.current).toBe(updatedContent)
    })
  })

  it('should re-render when file is created', async () => {
    const { result } = renderHook(() => useKnowledgeFile('newfile'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBeNull()

    const content = '# New File'
    appFS.writeFile(getTestPath('knowledge/newfile.md'), content)

    await waitFor(() => {
      expect(result.current).toBe(content)
    })
  })

  it('should re-render when file is deleted', async () => {
    const content = '# Content'
    appFS.writeFile(getTestPath('knowledge/file.md'), content)

    const { result } = renderHook(() => useKnowledgeFile('file'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile(getTestPath('knowledge/file.md'))

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when different file changes', async () => {
    let renderCount = 0

    appFS.writeFile(getTestPath('knowledge/file1.md'), 'content1')
    appFS.writeFile(getTestPath('knowledge/file2.md'), 'content2')

    const { result } = renderHook(() => {
      renderCount++
      return useKnowledgeFile('file1')
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile(getTestPath('knowledge/file2.md'), 'updated')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle files with special characters in name', () => {
    const content = '# My File'
    appFS.writeFile(getTestPath('knowledge/my-file_123.md'), content)

    const { result } = renderHook(() => useKnowledgeFile('my-file_123'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBe(content)
  })

  it('should handle files with nested paths', () => {
    const content = '# Nested File'
    appFS.writeFile(getTestPath('knowledge/domain/subdirectory/file.md'), content)

    const { result } = renderHook(() => useKnowledgeFile('domain/subdirectory/file'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBe(content)
  })

  it('should handle empty content', () => {
    appFS.writeFile(getTestPath('knowledge/empty.md'), '')

    const { result } = renderHook(() => useKnowledgeFile('empty'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toBe('')
  })
})
