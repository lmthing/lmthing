// src/hooks/agent/useAgentInstruct.ts

import { useMemo } from 'react'
import { useFile } from '../fs/useFile'
import { P } from '../../../lib/fs/paths'
import { parseAgentInstruct, serializeAgentInstruct, type AgentInstruct } from '../../../lib/fs/parsers/instruct'

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

export function useUpdateAgentInstruct(id: string): (instruct: AgentInstruct) => void {
  const { spaceFS } = require('../fs/useSpaceFS')

  return (instruct: AgentInstruct) => {
    const spaceFS = require('../fs/useSpaceFS').useSpaceFS()
    const content = serializeAgentInstruct(instruct)
    spaceFS.writeFile(P.instruct(id), content)
  }
}
