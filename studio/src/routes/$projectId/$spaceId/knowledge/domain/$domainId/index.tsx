import { createFileRoute } from '@tanstack/react-router'
import { DomainMetadataPanel } from '@lmthing/ui/components/knowledge/domain/domain-metadata-panel'

function DomainMetadataPage() {
  const { domainId } = Route.useParams()
  return <DomainMetadataPanel domain={domainId} />
}

export const Route = createFileRoute('/$projectId/$spaceId/knowledge/domain/$domainId/')({
  component: DomainMetadataPage,
})
