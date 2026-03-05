'use client'

import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { useWorkflowList } from '@/hooks/useWorkflowList'
import { Badge } from '@/elements/content/badge'
import { Stack } from '@/elements/layouts/stack'

/**
 * Workflow list page.
 */
export default function WorkflowListPage() {
  const workflows = useWorkflowList()

  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Workflows</Heading>
      <Caption muted style={{ marginBottom: '1rem' }}>
        {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} configured.
      </Caption>
      <Stack gap="sm">
        {workflows.map(w => (
          <Badge key={w.id} variant="muted">{w.id}</Badge>
        ))}
      </Stack>
    </div>
  )
}
