// OptionItem — displays one option file in a knowledge field
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'

interface OptionItemProps {
  slug: string
  path: string
}

export function OptionItem({ slug, path }: OptionItemProps) {
  return (
    <Card data-option-slug={slug}>
      <CardBody>
        <Heading level={4}>{slug}</Heading>
        <Caption muted>{path}</Caption>
      </CardBody>
    </Card>
  )
}

// backward compat
export { OptionItem as SubjectItem }
