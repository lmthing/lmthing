// src/hooks/agent/useAgentValues.ts

import { useMemo } from 'react'
import { useFile } from '../fs/useFile'
import { P } from '../../lib/fs/paths'
import { parseAgentValues, serializeAgentValues, type AgentValues } from '../../lib/fs/parsers/config'

export function useAgentValues(id: string): AgentValues | null {
  const content = useFile(P.agentValues(id))

  return useMemo(() => {
    if (!content) return null
    try {
      return parseAgentValues(content)
    } catch {
      return null
    }
  }, [content])
}
