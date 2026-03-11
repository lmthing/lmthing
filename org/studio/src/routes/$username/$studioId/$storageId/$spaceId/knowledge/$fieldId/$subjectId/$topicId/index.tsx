import { createFileRoute } from '@tanstack/react-router'
import { TopicViewer } from '@/components/knowledge/topic-detail/topic-viewer'

function TopicDetailPage() {
  const { fieldId, topicId } = Route.useParams()
  return (
    <TopicViewer
      fieldId={fieldId}
      topicPath={`knowledge/${fieldId}/${topicId}.md`}
    />
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/knowledge/$fieldId/$subjectId/$topicId/',
)({
  component: TopicDetailPage,
})
