'use client'

import { use } from 'react'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

/**
 * Workflow step detail page.
 */
export default function StepDetailPage({
  params,
}: {
  params: Promise<{ workflowId: string; stepId: string }>
}) {
  const { workflowId, stepId } = use(params)
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Step: {stepId}</Heading>
      <Caption muted>Workflow: {workflowId}</Caption>
    </div>
  )
}
