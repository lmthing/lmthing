import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { useWorkflowList } from '@lmthing/ui/hooks/useWorkflowList'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Stack } from '@lmthing/ui/elements/layouts/stack'

function WorkflowListPage() {
  const workflows = useWorkflowList()
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Workflows</Heading>
      <Caption muted style={{ marginBottom: '1rem' }}>
        {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}{' '}
        configured.
      </Caption>
      <Stack gap="sm">
        {workflows.map((w) => (
          <Badge key={w.id} variant="muted">
            {w.id}
          </Badge>
        ))}
      </Stack>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/workflow/',
)({
  component: WorkflowListPage,
})
