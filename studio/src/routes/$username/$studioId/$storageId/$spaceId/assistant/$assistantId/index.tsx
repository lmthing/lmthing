import { createFileRoute } from '@tanstack/react-router'
import { AssistantBuilder } from '@lmthing/ui/components/assistant/builder/assistant-builder'

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/assistant/$assistantId/',
)({
  component: () => <AssistantBuilder />,
})
