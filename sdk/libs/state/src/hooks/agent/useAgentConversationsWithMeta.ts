// src/hooks/agent/useAgentConversationsWithMeta.ts

import { useMemo } from 'react'
import { useGlobRead } from '../fs/useGlobRead'
import { P } from '../../lib/fs/paths'
import { parseConversation } from '../../lib/fs/parsers/conversation'

export interface ConversationSummary {
  id: string
  path: string
  title?: string
  updatedAt: string
  messageCount: number
}

export function useAgentConversationsWithMeta(agentId: string): ConversationSummary[] {
  const files = useGlobRead(P.globs.allConversations(agentId))

  return useMemo(() => {
    const summaries: ConversationSummary[] = []
    for (const [path, content] of Object.entries(files)) {
      try {
        const conv = parseConversation(content)
        summaries.push({
          id: conv.metadata.id || path.split('/').pop()?.replace('.json', '') || '',
          path,
          title: conv.metadata.title,
          updatedAt: conv.metadata.updatedAt,
          messageCount: conv.metadata.messageCount,
        })
      } catch {
        // Skip invalid files
      }
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [files])
}
