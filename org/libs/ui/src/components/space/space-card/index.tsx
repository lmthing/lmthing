import { Card, CardBody } from '@/elements/content/card'
import { Heading } from '@/elements/typography/heading'
import '@/css/elements/content/card/index.css'

interface SpaceCardProps {
  id: string
  name: string
}

export function SpaceCard({ id, name }: SpaceCardProps) {
  return (
    <Card data-space-id={id}>
      <CardBody>
        <Heading level={4}>{name}</Heading>
      </CardBody>
    </Card>
  )
}
