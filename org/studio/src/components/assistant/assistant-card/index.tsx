import { Card, CardBody } from '@/elements/content/card'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Badge } from '@/elements/content/badge'
import { useAssistant } from '@/hooks/useAssistant'
import '@/css/elements/content/card/index.css'

interface AssistantCardProps {
  id: string
  name?: string
}

export function AssistantCard({ id, name }: AssistantCardProps) {
  const assistant = useAssistant(id)

  const displayName = name || assistant?.instruct?.name || 'Untitled Assistant'

  return (
    <Card data-assistant-id={id}>
      <CardBody>
        <Heading level={4}>{displayName}</Heading>
        {assistant?.instruct?.description && <Caption muted>{assistant.instruct.description}</Caption>}
      </CardBody>
    </Card>
  )
}
