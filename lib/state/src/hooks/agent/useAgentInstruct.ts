// src/hooks/agent/useAgentInstruct.ts

import { useMemo } from 'react'
import { useFile } from '@/hooks/fs/useFile'
import { P } from '@/lib/fs/paths'
import { parseAgentInstruct, serializeAgentInstruct, type AgentInstruct } from '@/lib/fs/parsers/instruct'

export function useAgentInstruct(id: string): AgentInstruct | null {
  const content = useFile(P.instruct(id))

  return useMemo(() => {
    if (!content) return null
    try {
      return parseAgentInstruct(content)
    } catch {
      return null
    }
  }, [content])
}
