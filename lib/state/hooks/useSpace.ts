// src/hooks/useSpace.ts

import { useMemo } from 'react'
import { usePackageJson } from './workspace/usePackageJson'
import { useAgentList } from './useAgentList'
import { useFlowList } from './useFlowList'
import { useDomainDirectory } from './useDomainDirectory'
import type { PackageJson } from './workspace/usePackageJson'
import type { AgentListItem } from './useAgentList'
import type { FlowListItem } from './useFlowList'
import type { DomainMeta } from './useDomainDirectory'

export interface Space {
  packageJson: PackageJson | null
  agents: AgentListItem[]
  flows: FlowListItem[]
  domains: DomainMeta[]
}

export function useSpace(): Space {
  const packageJson = usePackageJson()
  const agents = useAgentList()
  const flows = useFlowList()
  const domains = useDomainDirectory()

  return useMemo(() => ({
    packageJson,
    agents,
    flows,
    domains
  }), [packageJson, agents, flows, domains])
}
