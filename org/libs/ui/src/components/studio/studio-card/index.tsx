import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import '@lmthing/css/elements/content/card/index.css'

interface StudioCardProps {
  id: string
  name: string
  description?: string
}

export function StudioCard({ id, name, description }: StudioCardProps) {
  return (
    <Card data-studio-id={id}>
      <CardBody>
        <Heading level={4}>{name}</Heading>
        {description && <Caption muted>{description}</Caption>}
      </CardBody>
    </Card>
  )
}
