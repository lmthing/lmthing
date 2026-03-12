// src/hooks/agent/useAgentConfig.ts

import { useMemo } from 'react'
import { useFile } from '../fs/useFile'
import { P } from '../../lib/fs/paths'
import { parseAgentConfig, serializeAgentConfig, type AgentConfig } from '../../lib/fs/parsers/config'

export function useAgentConfig(id: string): AgentConfig | null {
  const content = useFile(P.agentConfig(id))

  return useMemo(() => {
    if (!content) return null
    try {
      return parseAgentConfig(content)
    } catch {
      return null
    }
  }, [content])
}
