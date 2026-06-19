// src/hooks/agent/useAgentConfig.ts
//
// The new spec has no per-agent config.json. Runtime field selections now live
// in the agent's instruct.md frontmatter (`runtimeFields`). This hook returns
// that map (component name → list of field refs), or null when the agent has
// no instruct.md / no runtimeFields.

import { useAgentInstruct } from './useAgentInstruct'

export function useAgentConfig(id: string): Record<string, string[]> | null {
  const instruct = useAgentInstruct(id)
  if (!instruct) return null
  return instruct.runtimeFields ?? null
}
