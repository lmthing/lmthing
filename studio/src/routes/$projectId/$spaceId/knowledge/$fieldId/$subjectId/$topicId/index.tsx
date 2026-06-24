import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/$projectId/$spaceId/knowledge/$fieldId/$subjectId/$topicId/',
)({
  beforeLoad: ({ params }) => {
    const { projectId, spaceId, fieldId } = params
    throw redirect({
      to: '/$projectId/$spaceId/knowledge/$fieldId',
      params: { projectId, spaceId, fieldId },
    })
  },
  component: () => null,
})
