// src/hooks/agent/useAgentConversations.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppFS } from '../../lib/fs/AppFS'
import { createTestWrapper, getTestPath } from '../../test-utils'
import { useAgentConversations } from './useAgentConversations'

describe('useAgentConversations', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should list agent conversations', () => {
    const conv1 = {
      metadata: {
        id: 'conv1',
        agentId: 'bot',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        messageCount: 2
      },
      messages: []
    }

    const conv2 = {
      metadata: {
        id: 'conv2',
        agentId: 'bot',
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        messageCount: 5
      },
      messages: []
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/conv1.json', JSON.stringify(conv1))
    appFS.writeFile('alice/test/space1/agents/bot/conversations/conv2.json', JSON.stringify(conv2))

    const { result } = renderHook(() => useAgentConversations('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toHaveLength(2)
    expect(result.current[0].id).toBe('conv1')
    expect(result.current[1].id).toBe('conv2')
  })

  it('should return empty array for agent with no conversations', () => {
    const { result } = renderHook(() => useAgentConversations('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toEqual([])
  })

  it('should return conversation paths', () => {
    const conv = {
      metadata: {
        id: 'chat-1',
        agentId: 'bot',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        messageCount: 0
      },
      messages: []
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat-1.json', JSON.stringify(conv))

    const { result } = renderHook(() => useAgentConversations('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current[0].id).toBe('chat-1')
    expect(result.current[0].path).toContain('chat-1.json')
  })

  it('should filter out non-JSON files', () => {
    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat1.json', '{"metadata": {}}')
    appFS.writeFile('alice/test/space1/agents/bot/conversations/.gitkeep', '')
    appFS.writeFile('alice/test/space1/agents/bot/conversations/readme.md', '# Readme')

    const { result } = renderHook(() => useAgentConversations('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('chat1')
  })

  it('should re-render when conversation is added', async () => {
    const conv1 = {
      metadata: { id: 'conv1', agentId: 'bot', createdAt: '', updatedAt: '', messageCount: 0 },
      messages: []
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/conv1.json', JSON.stringify(conv1))

    const { result } = renderHook(() => useAgentConversations('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toHaveLength(1)

    const conv2 = {
      metadata: { id: 'conv2', agentId: 'bot', createdAt: '', updatedAt: '', messageCount: 0 },
      messages: []
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/conv2.json', JSON.stringify(conv2))

    await waitFor(() => {
      expect(result.current).toHaveLength(2)
    })
  })

  it('should re-render when conversation is deleted', async () => {
    const conv = {
      metadata: { id: 'conv1', agentId: 'bot', createdAt: '', updatedAt: '', messageCount: 0 },
      messages: []
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/conv1.json', JSON.stringify(conv))

    const { result } = renderHook(() => useAgentConversations('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toHaveLength(1)

    appFS.deleteFile('alice/test/space1/agents/bot/conversations/conv1.json')

    await waitFor(() => {
      expect(result.current).toHaveLength(0)
    })
  })

  it('should not re-render when different agent changes', async () => {
    let renderCount = 0

    appFS.writeFile('alice/test/space1/agents/bot1/conversations/conv1.json', '{"metadata": {}}')
    appFS.writeFile('alice/test/space1/agents/bot2/conversations/conv2.json', '{"metadata": {}}')

    const { result } = renderHook(() => {
      renderCount++
      return useAgentConversations('bot1')
    }, {
      wrapper: createTestWrapper(appFS)
    })

    const initialCount = renderCount

    appFS.writeFile('alice/test/space1/agents/bot2/conversations/conv3.json', '{"metadata": {}}')

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })

  it('should handle many conversations', () => {
    for (let i = 0; i < 50; i++) {
      const conv = {
        metadata: { id: `conv${i}`, agentId: 'bot', createdAt: '', updatedAt: '', messageCount: 0 },
        messages: []
      }
      appFS.writeFile(`alice/test/space1/agents/bot/conversations/conv${i}.json`, JSON.stringify(conv))
    }

    const { result } = renderHook(() => useAgentConversations('bot'), {
      wrapper: createTestWrapper(appFS)
    })

    expect(result.current).toHaveLength(50)
  })
})
