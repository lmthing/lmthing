import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'

export const Route = createFileRoute('/$projectId/$spaceId/')({
  component: () => (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Space Overview</Heading>
      <Caption muted>
        Select an agent, tasklist, or knowledge area from the sidebar.
      </Caption>
    </div>
  ),
})
