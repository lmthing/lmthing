import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { useAgent } from '@lmthing/ui/hooks/useAgent'
import '@lmthing/css/elements/content/card/index.css'

interface AgentCardProps {
  id: string
  name?: string
}

export function AgentCard({ id, name }: AgentCardProps) {
  const agent = useAgent(id)

  const displayName = name || agent?.instruct?.name || 'Untitled Agent'

  return (
    <Card data-agent-id={id}>
      <CardBody>
        <Heading level={4}>{displayName}</Heading>
        {agent?.instruct?.description && <Caption muted>{agent.instruct.description}</Caption>}
      </CardBody>
    </Card>
  )
}
