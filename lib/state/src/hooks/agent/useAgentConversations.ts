// src/hooks/agent/useAgentConversations.ts

import { useMemo } from 'react'
import { useDir } from '@/hooks/fs/useDir'
import { P } from '@/lib/fs/paths'

export interface ConversationMeta {
  id: string
  path: string
}

export function useAgentConversations(id: string): ConversationMeta[] {
  const entries = useDir(P.conversations(id))

  return useMemo(() => {
    return entries
      .filter(e => e.type === 'file' && e.name.endsWith('.json'))
      .map(e => ({
        id: e.name.replace('.json', ''),
        path: e.path
      }))
  }, [entries])
}
