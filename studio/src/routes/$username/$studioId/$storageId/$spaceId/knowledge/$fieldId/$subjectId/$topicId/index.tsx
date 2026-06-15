import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/knowledge/$fieldId/$subjectId/$topicId/',
)({
  beforeLoad: ({ params }) => {
    const { username, studioId, storageId, spaceId, fieldId } = params
    throw redirect({
      to: `/${username}/${studioId}/${storageId}/${spaceId}/knowledge/${fieldId}`,
    })
  },
  component: () => null,
})
