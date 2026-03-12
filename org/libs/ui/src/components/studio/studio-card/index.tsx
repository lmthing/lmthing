import { Card, CardBody } from '@/elements/content/card'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import '@/css/elements/content/card/index.css'

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
