'use client'

import { use } from 'react'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

/**
 * Assistant chat view page.
 */
export default function AssistantChatPage({
  params,
}: {
  params: Promise<{ assistantId: string }>
}) {
  const { assistantId } = use(params)
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Chat</Heading>
      <Caption muted>Conversation with assistant: {assistantId}</Caption>
    </div>
  )
}
