// src/hooks/agent/useAgentValues.ts
//
// The new spec has no per-agent values.json. Saved form values now live in the
// agent's instruct.md frontmatter (`formValues`). This hook returns that map
// (component name → key/value map), or null when the agent has no instruct.md /
// no formValues.

import { useAgentInstruct } from './useAgentInstruct'

export function useAgentValues(id: string): Record<string, Record<string, unknown>> | null {
  const instruct = useAgentInstruct(id)
  if (!instruct) return null
  return instruct.formValues ?? null
}
