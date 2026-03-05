// src/hooks/agent/useAgentConversation.test.tsx

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProvider } from '../../lib/contexts/AppContext'
import { StudioProvider } from '../../lib/contexts/StudioContext'
import { SpaceProvider } from '../../lib/contexts/SpaceContext'
import { AppFS } from '../../lib/fs/AppFS'
import { useAgentConversation } from './useAgentConversation'

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

describe('useAgentConversation', () => {
  let appFS: AppFS

  beforeEach(() => {
    appFS = new AppFS()
  })

  it('should parse conversation', () => {
    const conv = {
      metadata: {
        id: 'chat1',
        agentId: 'bot',
        title: 'Test Chat',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        messageCount: 2
      },
      messages: [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ]
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat1.json', JSON.stringify(conv))

    const { result } = renderHook(() => useAgentConversation('bot', 'chat1'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.metadata.id).toBe('chat1')
    expect(result.current?.metadata.title).toBe('Test Chat')
    expect(result.current?.messages).toHaveLength(2)
    expect(result.current?.messages[0].role).toBe('user')
    expect(result.current?.messages[0].content).toBe('Hello')
  })

  it('should return null for non-existent conversation', () => {
    const { result } = renderHook(() => useAgentConversation('bot', 'non-existent'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()
  })

  it('should parse messages with timestamps and tokens', () => {
    const conv = {
      metadata: {
        id: 'chat1',
        agentId: 'bot',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        messageCount: 1
      },
      messages: [
        {
          role: 'user' as const,
          content: 'Hello',
          timestamp: '2024-01-01T00:00:00Z',
          tokens: 5
        }
      ]
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat1.json', JSON.stringify(conv))

    const { result } = renderHook(() => useAgentConversation('bot', 'chat1'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.messages[0].timestamp).toBe('2024-01-01T00:00:00Z')
    expect(result.current?.messages[0].tokens).toBe(5)
  })

  it('should handle all message roles', () => {
    const conv = {
      metadata: {
        id: 'chat1',
        agentId: 'bot',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        messageCount: 3
      },
      messages: [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi' }
      ]
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat1.json', JSON.stringify(conv))

    const { result } = renderHook(() => useAgentConversation('bot', 'chat1'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.messages[0].role).toBe('system')
    expect(result.current?.messages[1].role).toBe('user')
    expect(result.current?.messages[2].role).toBe('assistant')
  })

  it('should handle invalid JSON gracefully', () => {
    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat1.json', 'not json')

    const { result } = renderHook(() => useAgentConversation('bot', 'chat1'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()
    expect(result.current?.metadata.id).toBe('')
    expect(result.current?.messages).toEqual([])
  })

  it('should re-render when conversation is updated', async () => {
    const conv = {
      metadata: {
        id: 'chat1',
        agentId: 'bot',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        messageCount: 1
      },
      messages: [
        { role: 'user' as const, content: 'Hello' }
      ]
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat1.json', JSON.stringify(conv))

    const { result } = renderHook(() => useAgentConversation('bot', 'chat1'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current?.messages).toHaveLength(1)

    const updatedConv = {
      metadata: {
        id: 'chat1',
        agentId: 'bot',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T01:00:00Z',
        messageCount: 2
      },
      messages: [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ]
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat1.json', JSON.stringify(updatedConv))

    await waitFor(() => {
      expect(result.current?.messages).toHaveLength(2)
    })
  })

  it('should re-render when conversation is created', async () => {
    const { result } = renderHook(() => useAgentConversation('bot', 'newchat'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).toBeNull()

    const conv = {
      metadata: {
        id: 'newchat',
        agentId: 'bot',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        messageCount: 0
      },
      messages: []
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/newchat.json', JSON.stringify(conv))

    await waitFor(() => {
      expect(result.current?.metadata.id).toBe('newchat')
    })
  })

  it('should re-render when conversation is deleted', async () => {
    const conv = {
      metadata: {
        id: 'chat1',
        agentId: 'bot',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        messageCount: 0
      },
      messages: []
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat1.json', JSON.stringify(conv))

    const { result } = renderHook(() => useAgentConversation('bot', 'chat1'), {
      wrapper: createWrapper(appFS)
    })

    expect(result.current).not.toBeNull()

    appFS.deleteFile('alice/test/space1/agents/bot/conversations/chat1.json')

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('should not re-render when different conversation changes', async () => {
    let renderCount = 0

    const conv1 = {
      metadata: { id: 'chat1', agentId: 'bot', createdAt: '', updatedAt: '', messageCount: 0 },
      messages: []
    }

    const conv2 = {
      metadata: { id: 'chat2', agentId: 'bot', createdAt: '', updatedAt: '', messageCount: 0 },
      messages: []
    }

    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat1.json', JSON.stringify(conv1))
    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat2.json', JSON.stringify(conv2))

    const { result } = renderHook(() => {
      renderCount++
      return useAgentConversation('bot', 'chat1')
    }, {
      wrapper: createWrapper(appFS)
    })

    const initialCount = renderCount

    // Update different conversation
    const updatedConv2 = {
      ...conv2,
      metadata: { ...conv2.metadata, title: 'Updated' }
    }
    appFS.writeFile('alice/test/space1/agents/bot/conversations/chat2.json', JSON.stringify(updatedConv2))

    await waitFor(() => {
      expect(renderCount).toBe(initialCount)
    })
  })
})
