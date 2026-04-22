import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { useKnowledgeFields } from '@lmthing/ui/hooks/useKnowledgeFields'
import '@lmthing/css/elements/content/card/index.css'
import '@lmthing/css/elements/layouts/stack/index.css'

interface SubjectListProps {
  fieldId: string
}

export function SubjectList({ fieldId }: SubjectListProps) {
  const fields = useKnowledgeFields()
  const field = fields.find((f: { id: string }) => f.id === fieldId)

  const subjects = (field as any)?.subjects ?? []

  return (
    <Stack gap="md">
      <div>
        <Heading level={3}>Subjects</Heading>
        <Caption muted>
          {subjects.length} subject{subjects.length !== 1 ? 's' : ''} in {fieldId}
        </Caption>
      </div>

      {subjects.length === 0 ? (
        <Caption muted>No subjects found for this field.</Caption>
      ) : (
        <Stack gap="sm">
          {subjects.map((subject: { id: string; name: string; path: string }) => (
            <Card key={subject.id}>
              <CardBody>
                <Heading level={4}>{subject.name}</Heading>
                <Caption muted>{subject.path}</Caption>
              </CardBody>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
