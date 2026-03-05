'use client'

import { use } from 'react'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

/**
 * Specific conversation view page.
 */
export default function ConversationPage({
  params,
}: {
  params: Promise<{ assistantId: string; conversationId: string }>
}) {
  const { assistantId, conversationId } = use(params)
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Conversation</Heading>
      <Caption muted>
        Assistant: {assistantId} / Conversation: {conversationId}
      </Caption>
    </div>
  )
}
