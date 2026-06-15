import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { useAgent } from '@lmthing/state'
import '@lmthing/css/elements/content/card/index.css'

interface AgentCardProps {
  id: string
  title?: string
}

export function AgentCard({ id, title }: AgentCardProps) {
  const agent = useAgent(id)
  const displayTitle = title || agent?.instruct?.title || 'Untitled Agent'
  const actionCount = agent?.instruct?.actions?.length ?? 0

  return (
    <Card data-agent-id={id}>
      <CardBody>
        <Heading level={4}>{displayTitle}</Heading>
        {actionCount > 0 && (
          <Badge variant="muted">{actionCount} action{actionCount !== 1 ? 's' : ''}</Badge>
        )}
      </CardBody>
    </Card>
  )
}
