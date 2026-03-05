// src/hooks/agent/useAgentConversation.ts

import { useMemo } from 'react'
import { useFile } from '@/hooks/fs/useFile'
import { P } from '@/lib/fs/paths'
import { parseConversation, serializeConversation, type Conversation } from '@/lib/fs/parsers/conversation'

export function useAgentConversation(agentId: string, conversationId: string): Conversation | null {
  const content = useFile(P.conversation(agentId, conversationId))

  return useMemo(() => {
    if (!content) return null
    try {
      return parseConversation(content)
    } catch {
      return null
    }
  }, [content])
}
