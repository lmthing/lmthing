'use client'

import { use } from 'react'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

/**
 * Assistant workflow editor (promoted from modal).
 */
export default function AssistantWorkflowPage({
  params,
}: {
  params: Promise<{ assistantId: string; workflowId: string }>
}) {
  const { assistantId, workflowId } = use(params)
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Workflow Editor</Heading>
      <Caption muted>
        Assistant: {assistantId} / Workflow: {workflowId}
      </Caption>
    </div>
  )
}
