import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import '@lmthing/css/elements/content/card/index.css'

interface FieldCardProps {
  id: string
  path: string
}

export function FieldCard({ id, path }: FieldCardProps) {
  const displayName = path.split('/').pop() || id

  return (
    <Card data-field-id={id}>
      <CardBody>
        <Heading level={4}>{displayName}</Heading>
        <Caption muted>{path}</Caption>
      </CardBody>
    </Card>
  )
}
