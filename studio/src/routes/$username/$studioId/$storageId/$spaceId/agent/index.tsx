import { createFileRoute } from '@tanstack/react-router'
import { AgentBuilder } from '@lmthing/ui/components/agent/builder/agent-builder'

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/agent/',
)({
  component: () => <AgentBuilder />,
})
