'use client'

import { use } from 'react'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

/**
 * Workflow builder / detail page.
 */
export default function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ workflowId: string }>
}) {
  const { workflowId } = use(params)
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Workflow: {workflowId}</Heading>
      <Caption muted>Edit workflow steps and configuration.</Caption>
    </div>
  )
}
