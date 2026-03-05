'use client'

import { use } from 'react'
import { TopicViewer } from '@/components/knowledge/topic-detail/topic-viewer'

/**
 * Topic editor page.
 */
export default function TopicDetailPage({
  params,
}: {
  params: Promise<{ fieldId: string; subjectId: string; topicId: string }>
}) {
  const { fieldId, topicId } = use(params)
  return <TopicViewer domainId={fieldId} topicPath={`knowledge/${fieldId}/${topicId}.md`} />
}
