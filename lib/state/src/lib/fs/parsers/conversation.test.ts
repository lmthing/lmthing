// src/lib/fs/parsers/conversation.test.ts

import { describe, it, expect } from 'vitest'
import {
  parseConversation,
  serializeConversation,
  createConversation,
  addMessage,
  type Conversation
} from './conversation'

describe('conversation parser', () => {
  describe('parseConversation', () => {
    it('should parse basic conversation', () => {
      const content = JSON.stringify({
        metadata: {
          id: 'conv-1',
          agentId: 'bot-1',
          title: 'Test Chat',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          messageCount: 2
        },
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      })

      const result = parseConversation(content)

      expect(result.metadata.id).toBe('conv-1')
      expect(result.metadata.agentId).toBe('bot-1')
      expect(result.metadata.title).toBe('Test Chat')
      expect(result.messages).toHaveLength(2)
      expect(result.messages[0].role).toBe('user')
      expect(result.messages[0].content).toBe('Hello')
    })

    it('should parse messages with timestamps and tokens', () => {
      const content = JSON.stringify({
        metadata: {
          id: 'conv-1',
          agentId: 'bot-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          messageCount: 1
        },
        messages: [
          {
            role: 'user',
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00Z',
            tokens: 5
          }
        ]
      })

      const result = parseConversation(content)

      expect(result.messages[0].timestamp).toBe('2024-01-01T00:00:00Z')
      expect(result.messages[0].tokens).toBe(5)
    })

    it('should handle all message roles', () => {
      const content = JSON.stringify({
        metadata: {
          id: 'conv-1',
          agentId: 'bot-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          messageCount: 3
        },
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' }
        ]
      })

      const result = parseConversation(content)

      expect(result.messages[0].role).toBe('system')
      expect(result.messages[1].role).toBe('user')
      expect(result.messages[2].role).toBe('assistant')
    })

    it('should handle invalid JSON gracefully', () => {
      const result = parseConversation('not json')

      expect(result.metadata.id).toBe('')
      expect(result.metadata.agentId).toBe('')
      expect(result.messages).toEqual([])
    })

    it('should handle missing metadata', () => {
      const content = JSON.stringify({
        messages: []
      })

      const result = parseConversation(content)

      expect(result.metadata.id).toBe('')
      expect(result.messages).toEqual([])
    })
  })

  describe('serializeConversation', () => {
    it('should serialize conversation to JSON', () => {
      const conversation: Conversation = {
        metadata: {
          id: 'conv-1',
          agentId: 'bot-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          messageCount: 1
        },
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      }

      const result = serializeConversation(conversation)

      const parsed = JSON.parse(result)
      expect(parsed.metadata.id).toBe('conv-1')
      expect(parsed.messages[0].content).toBe('Hello')
    })

    it('should update messageCount and updatedAt on serialize', () => {
      const conversation: Conversation = {
        metadata: {
          id: 'conv-1',
          agentId: 'bot-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          messageCount: 0 // Wrong count
        },
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' }
        ]
      }

      const result = serializeConversation(conversation)

      const parsed = JSON.parse(result)
      expect(parsed.metadata.messageCount).toBe(2)
      expect(parsed.metadata.updatedAt).not.toBe('2024-01-01T00:00:00Z')
    })

    it('should round-trip correctly', () => {
      const original = {
        metadata: {
          id: 'conv-1',
          agentId: 'bot-1',
          title: 'Chat',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          messageCount: 2
        },
        messages: [
          { role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z', tokens: 5 },
          { role: 'assistant', content: 'Hi there!', timestamp: '2024-01-01T00:01:00Z', tokens: 8 }
        ]
      }

      const serialized = serializeConversation(original as Conversation)
      const parsed = parseConversation(serialized)

      expect(parsed.metadata.id).toBe(original.metadata.id)
      expect(parsed.messages).toHaveLength(2)
      expect(parsed.messages[0].content).toBe('Hello')
      expect(parsed.messages[1].tokens).toBe(8)
    })
  })

  describe('createConversation', () => {
    it('should create new conversation with metadata', () => {
      const result = createConversation('conv-1', 'bot-1', 'Test Chat')

      expect(result.metadata.id).toBe('conv-1')
      expect(result.metadata.agentId).toBe('bot-1')
      expect(result.metadata.title).toBe('Test Chat')
      expect(result.metadata.messageCount).toBe(0)
      expect(result.messages).toEqual([])
    })

    it('should create timestamps', () => {
      const result = createConversation('conv-1', 'bot-1')

      expect(result.metadata.createdAt).toBeDefined()
      expect(result.metadata.updatedAt).toBeDefined()
      expect(result.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should handle optional title', () => {
      const result = createConversation('conv-1', 'bot-1')

      expect(result.metadata.title).toBeUndefined()
    })
  })

  describe('addMessage', () => {
    it('should add message to conversation', () => {
      const conv = createConversation('conv-1', 'bot-1')

      const result = addMessage(conv, 'user', 'Hello')

      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].role).toBe('user')
      expect(result.messages[0].content).toBe('Hello')
    })

    it('should add timestamp to message', () => {
      const conv = createConversation('conv-1', 'bot-1')

      const result = addMessage(conv, 'user', 'Hello')

      expect(result.messages[0].timestamp).toBeDefined()
      expect(result.messages[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should add tokens to message if provided', () => {
      const conv = createConversation('conv-1', 'bot-1')

      const result = addMessage(conv, 'user', 'Hello', 5)

      expect(result.messages[0].tokens).toBe(5)
    })

    it('should return new object (immutable)', () => {
      const conv = createConversation('conv-1', 'bot-1')

      const result = addMessage(conv, 'user', 'Hello')

      expect(conv).not.toBe(result)
      expect(conv.messages).toHaveLength(0)
      expect(result.messages).toHaveLength(1)
    })

    it('should add multiple messages', () => {
      let conv = createConversation('conv-1', 'bot-1')

      conv = addMessage(conv, 'user', 'Hello')
      conv = addMessage(conv, 'assistant', 'Hi there!')
      conv = addMessage(conv, 'user', 'How are you?')

      expect(conv.messages).toHaveLength(3)
      expect(conv.messages[0].content).toBe('Hello')
      expect(conv.messages[1].content).toBe('Hi there!')
      expect(conv.messages[2].content).toBe('How are you?')
    })

    it('should support all role types', () => {
      let conv = createConversation('conv-1', 'bot-1')

      conv = addMessage(conv, 'system', 'You are helpful')
      conv = addMessage(conv, 'user', 'Hello')
      conv = addMessage(conv, 'assistant', 'Hi')

      expect(conv.messages[0].role).toBe('system')
      expect(conv.messages[1].role).toBe('user')
      expect(conv.messages[2].role).toBe('assistant')
    })
  })

  describe('conversation flow integration', () => {
    it('should support complete conversation lifecycle', () => {
      // Create
      let conv = createConversation('conv-1', 'bot-1', 'Test Chat')

      // Add messages
      conv = addMessage(conv, 'system', 'You are a helpful assistant.')
      conv = addMessage(conv, 'user', 'What is 2+2?')
      conv = addMessage(conv, 'assistant', '2+2 equals 4.', 15)

      // Serialize
      const serialized = serializeConversation(conv)

      // Parse
      const parsed = parseConversation(serialized)

      // Verify
      expect(parsed.metadata.id).toBe('conv-1')
      expect(parsed.metadata.title).toBe('Test Chat')
      expect(parsed.metadata.messageCount).toBe(3)
      expect(parsed.messages).toHaveLength(3)
      expect(parsed.messages[0].content).toBe('You are a helpful assistant.')
      expect(parsed.messages[1].content).toBe('What is 2+2?')
      expect(parsed.messages[2].content).toBe('2+2 equals 4.')
      expect(parsed.messages[2].tokens).toBe(15)
    })
  })
})
