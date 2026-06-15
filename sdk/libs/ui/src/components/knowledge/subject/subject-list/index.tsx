// SubjectList — now shows Fields within a Domain
import { useMemo } from 'react'
import { useGlob } from '@lmthing/state'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'

interface SubjectListProps {
  domain: string
}

export function SubjectList({ domain }: SubjectListProps) {
  const indexFiles = useGlob(`knowledge/${domain}/*/index.md`)

  const fields = useMemo(() => {
    return indexFiles.map(p => {
      const parts = p.split('/')
      const fieldSlug = parts[parts.length - 2]
      return { slug: fieldSlug, path: `knowledge/${domain}/${fieldSlug}` }
    }).sort((a, b) => a.slug.localeCompare(b.slug))
  }, [indexFiles, domain])

  return (
    <Stack gap="md">
      <div>
        <Heading level={3}>Fields</Heading>
        <Caption muted>{fields.length} field{fields.length !== 1 ? 's' : ''} in {domain}</Caption>
      </div>
      {fields.length === 0 ? (
        <Caption muted>No fields in this domain.</Caption>
      ) : (
        <Stack gap="sm">
          {fields.map(f => (
            <Card key={f.slug}>
              <CardBody>
                <Heading level={4}>{f.slug}</Heading>
                <Caption muted>{f.path}/index.md</Caption>
              </CardBody>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
