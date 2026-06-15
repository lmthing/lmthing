// src/hooks/useAgent.ts

import { useMemo } from 'react'
import { useAgentInstruct } from './agent/useAgentInstruct'
import type { AgentInstruct } from '../lib/fs/parsers/instruct'

export interface Agent {
  id: string
  instruct: AgentInstruct | null
}

export function useAgent(id: string): Agent {
  const instruct = useAgentInstruct(id)

  return useMemo(() => ({
    id,
    instruct,
  }), [id, instruct])
}
