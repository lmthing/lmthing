import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

function FieldDetailPage() {
  const { fieldId } = Route.useParams()
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Field: {fieldId}</Heading>
      <Caption muted>
        Browse subjects and topics within this knowledge field.
      </Caption>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/knowledge/$fieldId/',
)({
  component: FieldDetailPage,
})
