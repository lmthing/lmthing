import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/',
)({
  component: () => (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Space Overview</Heading>
      <Caption muted>
        Select an assistant, workflow, or knowledge area from the sidebar.
      </Caption>
    </div>
  ),
})
