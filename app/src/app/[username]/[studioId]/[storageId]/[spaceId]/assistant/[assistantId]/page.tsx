'use client'

import { use } from 'react'
import { AssistantBuilder } from '@/components/assistant/builder/assistant-builder'

/**
 * Assistant detail / builder page.
 */
export default function AssistantDetailPage({
  params,
}: {
  params: Promise<{ assistantId: string }>
}) {
  const { assistantId } = use(params)
  return <AssistantBuilder />
}
