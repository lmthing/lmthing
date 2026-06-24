import { createFileRoute } from '@tanstack/react-router'
import { AgentBuilder } from '@lmthing/ui/components/agent/builder/agent-builder'

export const Route = createFileRoute('/$projectId/$spaceId/agent/new/')({
  component: () => <AgentBuilder />,
})
