import { createFileRoute } from '@tanstack/react-router'
import { AssistantBuilder } from '@/components/assistant/builder/assistant-builder'

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/assistant/',
)({
  component: () => <AssistantBuilder />,
})
