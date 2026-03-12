import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { useAssistant } from '@/hooks/useAssistant'
import '@lmthing/css/elements/content/card/index.css'

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
