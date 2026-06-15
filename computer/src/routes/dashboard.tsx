import { createFileRoute } from '@tanstack/react-router'
import { useComputer } from '@/lib/runtime/ComputerContext'
import { ComputerDashboard } from '@lmthing/ui/components/computer/computer-dashboard'
import { BootProgress } from '@lmthing/ui/components/computer/boot-progress'
import { useRef } from 'react'
import type { BootStage } from '@lmthing/ui/components/computer/boot-progress'

export const Route = createFileRoute('/dashboard')({
  component: DashboardRoute,
})

function mapStatusToBootStage(status: string): BootStage {
  if (status === 'running') return 'running'
  if (status === 'error') return 'error'
  return 'connecting'
}

function DashboardRoute() {
  const { status, metrics, processes, agents, logs, network } = useComputer()
  const bootedAt = useRef(Date.now())
  const uptime = status === 'running' ? Date.now() - bootedAt.current : 0

  if (status !== 'running' && status !== 'error') {
    return (
      <BootProgress
        tier="flyio"
        stage={mapStatusToBootStage(status)}
      />
    )
  }

  return (
    <ComputerDashboard
      status={status}
      tier="flyio"
      uptime={uptime}
      cpuPercent={metrics.cpuPercent}
      memoryUsedMB={metrics.memoryUsedMB}
      memoryTotalMB={metrics.memoryTotalMB}
      processes={processes}
      agents={agents}
      logs={logs}
      network={network}
    />
  )
}
