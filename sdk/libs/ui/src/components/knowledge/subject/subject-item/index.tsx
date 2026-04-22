import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import '@lmthing/css/elements/content/card/index.css'

interface SubjectItemProps {
  id: string
  name: string
  path: string
}

export function SubjectItem({ id, name, path }: SubjectItemProps) {
  return (
    <Card data-subject-id={id}>
      <CardBody>
        <Heading level={4}>{name}</Heading>
        <Caption muted>{path}</Caption>
      </CardBody>
    </Card>
  )
}
