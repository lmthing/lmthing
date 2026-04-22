// src/hooks/useAgent.ts

import { useMemo } from 'react'
import { useAgentInstruct } from './agent/useAgentInstruct'
import { useAgentConfig } from './agent/useAgentConfig'
import { useAgentValues } from './agent/useAgentValues'
import type { AgentInstruct } from '../lib/fs/parsers/instruct'
import type { AgentConfig } from '../lib/fs/parsers/config'
import type { AgentValues } from '../lib/fs/parsers/config'

export interface Agent {
  id: string
  instruct: AgentInstruct | null
  config: AgentConfig | null
  values: AgentValues | null
}

export function useAgent(id: string): Agent {
  const instruct = useAgentInstruct(id)
  const config = useAgentConfig(id)
  const values = useAgentValues(id)

  return useMemo(() => ({
    id,
    instruct,
    config,
    values
  }), [id, instruct, config, values])
}
