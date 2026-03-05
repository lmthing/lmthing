// src/hooks/knowledge/useKnowledgeConfig.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '@/lib/contexts/AppContext'
import { StudioProvider } from '@/lib/contexts/StudioContext'
import { SpaceProvider } from '@/lib/contexts/SpaceContext'
import { AppFS } from '@/lib/fs/AppFS'
import { useKnowledgeConfig } from './useKnowledgeConfig'

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

describe('useKnowledgeConfig', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should parse knowledge config', () => {
    const config = {
      title: 'Engineering',
      description: 'Engineering knowledge base',
      tags: ['python', 'javascript'],
      embeddingModel: 'text-embedding-ada-002'
    }

    appFS.writeFile('alice/test/space1/knowledge/engineering/config.json', JSON.stringify(config))

    const { result } = renderHook(() => useKnowledgeConfig('engineering'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.title).toBe('Engineering')
    expect(result.current?.description).toBe('Engineering knowledge base')
    expect(result.current?.tags).toEqual(['python', 'javascript'])
    expect(result.current?.embeddingModel).toBe('text-embedding-ada-002')
  })

  it('should return null for non-existent domain', () => {
    const { result } = renderHook(() => useKnowledgeConfig('non-existent'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should handle invalid JSON gracefully', () => {
    appFS.writeFile('alice/test/space1/knowledge/bad/config.json', 'not json')

    const { result } = renderHook(() => useKnowledgeConfig('bad'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toEqual({})
  })

  it('should parse all config fields', () => {
    const config = {
      title: 'Test',
      description: 'Test domain',
      tags: ['tag1', 'tag2'],
      embeddingModel: 'model',
      chunkSize: 1000,
      chunkOverlap: 200,
      customField: 'custom value'
    }

    appFS.writeFile('alice/test/space1/knowledge/test/config.json', JSON.stringify(config))

    const { result } = renderHook(() => useKnowledgeConfig('test'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.chunkSize).toBe(1000)
    expect(result.current?.chunkOverlap).toBe(200)
    expect(result.current?.customField).toBe('custom value')
  })

  it('should handle empty config', () => {
    appFS.writeFile('alice/test/space1/knowledge/empty/config.json', '{}')

    const { result } = renderHook(() => useKnowledgeConfig('empty'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toEqual({})
  })

  it('should re-render when config is updated', async () => {
    const initialConfig = { title: 'Original' }
    appFS.writeFile('alice/test/space1/knowledge/domain/config.json', JSON.stringify(initialConfig))

    const { result } = renderHook(() => useKnowledgeConfig('domain'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.title).toBe('Original')

    const updatedConfig = { title: 'Updated' }
    appFS.writeFile('alice/test/space1/knowledge/domain/config.json', JSON.stringify(updatedConfig))

    await waitFor(() => {
      expect(result.current?.title).toBe('Updated')
    })
  })

  it('should re-render when config is created', async () => {
    const { result } = renderHook(() => useKnowledgeConfig('newdomain'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()

    const config = { title: 'New Domain' }
    appFS.writeFile('alice/test/space1/knowledge/newdomain/config.json', JSON.stringify(config))

    await waitFor(() => {
      expect(result.current?.title).toBe('New Domain')
    })
  })

  it('should re-render when config is deleted', async () => {
    const config = { title: 'Test' }
    appFS.writeFile('alice/test/space1/knowledge/domain/config.json', JSON.stringify(config))

    const { result } = renderHook(() => useKnowledgeConfig('domain'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile('alice/test/space1/knowledge/domain/config.json')

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when different domain changes', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/knowledge/domain1/config.json', JSON.stringify({ title: '1' }))
    appFS.writeFile('alice/test/space1/knowledge/domain2/config.json', JSON.stringify({ title: '2' }))

    const { result } = renderHook(() => {
      renderCount++
      return useKnowledgeConfig('domain1')
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile('alice/test/space1/knowledge/domain2/config.json', JSON.stringify({ title: 'Updated' }))

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle domains with special characters in ID', () => {
    const config = { title: 'Test' }
    appFS.writeFile('alice/test/space1/knowledge/my-domain_123/config.json', JSON.stringify(config))

    const { result } = renderHook(() => useKnowledgeConfig('my-domain_123'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.title).toBe('Test')
  })
})
