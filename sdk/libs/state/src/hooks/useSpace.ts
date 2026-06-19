// src/hooks/useSpace.ts

import { useMemo } from 'react'
import { usePackageJson } from './workspace/usePackageJson'
import { useAgentList } from './useAgentList'
import { useTasklistList } from './useTasklistList'
import { useDomainDirectory } from './useDomainDirectory'
import type { PackageJson } from './workspace/usePackageJson'
import type { AgentListItem } from './useAgentList'
import type { TasklistListItem } from './useTasklistList'
import type { DomainMeta } from './useDomainDirectory'

export interface Space {
  packageJson: PackageJson | null
  agents: AgentListItem[]
  tasklists: TasklistListItem[]
  domains: DomainMeta[]
}

export function useSpace(): Space {
  const packageJson = usePackageJson()
  const agents = useAgentList()
  const tasklists = useTasklistList()
  const domains = useDomainDirectory()

  return useMemo(() => ({
    packageJson,
    agents,
    tasklists,
    domains
  }), [packageJson, agents, tasklists, domains])
}
