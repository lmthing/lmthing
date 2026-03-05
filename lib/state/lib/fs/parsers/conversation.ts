// src/lib/fs/parsers/conversation.ts

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  tokens?: number
}

export interface ConversationMetadata {
  id: string
  agentId: string
  title?: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface Conversation {
  metadata: ConversationMetadata
  messages: ConversationMessage[]
}

export function parseConversation(content: string): Conversation {
  try {
    const parsed = JSON.parse(content)
    return {
      metadata: parsed.metadata || {
        id: '',
        agentId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0
      },
      messages: parsed.messages || []
    }
  } catch {
    return {
      metadata: {
        id: '',
        agentId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0
      },
      messages: []
    }
  }
}

export function serializeConversation(conversation: Conversation): string {
  // Update metadata
  conversation.metadata.updatedAt = new Date().toISOString()
  conversation.metadata.messageCount = conversation.messages.length

  return JSON.stringify(conversation, null, 2)
}

export function createConversation(
  id: string,
  agentId: string,
  title?: string
): Conversation {
  const now = new Date().toISOString()
  return {
    metadata: {
      id,
      agentId,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0
    },
    messages: []
  }
}

export function addMessage(
  conversation: Conversation,
  role: ConversationMessage['role'],
  content: string,
  tokens?: number
): Conversation {
  const message: ConversationMessage = {
    role,
    content,
    timestamp: new Date().toISOString(),
    tokens
  }
  return {
    ...conversation,
    messages: [...conversation.messages, message]
  }
}
