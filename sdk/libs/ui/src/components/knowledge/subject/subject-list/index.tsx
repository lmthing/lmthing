// SubjectList — shows Fields within a Domain.
// Renders as TABS when the domain's index.md sets `renderAs: tabs`, otherwise
// (default) as a flat LIST. This is a studio-only UI hint — the agent runtime
// does not use it.
import { useMemo, useState } from 'react'
import { useGlob, useKnowledgeDomainIndex } from '@lmthing/state'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { TabBar } from '@lmthing/ui/elements/nav/tab-bar'

interface SubjectListProps {
  domain: string
}

interface FieldEntry {
  slug: string
  path: string
}

function FieldCard({ field }: { field: FieldEntry }) {
  return (
    <Card>
      <CardBody>
        <Heading level={4}>{field.slug}</Heading>
        <Caption muted>{field.path}/index.md</Caption>
      </CardBody>
    </Card>
  )
}

export function SubjectList({ domain }: SubjectListProps) {
  const indexFiles = useGlob(`knowledge/${domain}/*/index.md`)
  const domainIndex = useKnowledgeDomainIndex(domain)
  const renderAs = domainIndex?.renderAs ?? 'list'

  const fields = useMemo(() => {
    return indexFiles.map(p => {
      const parts = p.split('/')
      const fieldSlug = parts[parts.length - 2]
      return { slug: fieldSlug, path: `knowledge/${domain}/${fieldSlug}` }
    }).sort((a, b) => a.slug.localeCompare(b.slug))
  }, [indexFiles, domain])

  const [activeTab, setActiveTab] = useState<string | undefined>(fields[0]?.slug)
  const activeField = fields.find(f => f.slug === activeTab) ?? fields[0]

  return (
    <Stack gap="md">
      <div>
        <Heading level={3}>Fields</Heading>
        <Caption muted>{fields.length} field{fields.length !== 1 ? 's' : ''} in {domain}</Caption>
      </div>
      {fields.length === 0 ? (
        <Caption muted>No fields in this domain.</Caption>
      ) : renderAs === 'tabs' ? (
        <Stack gap="sm">
          <TabBar
            tabs={fields.map(f => ({ id: f.slug, label: f.slug }))}
            activeTab={activeTab ?? activeField?.slug}
            onTabChange={setActiveTab}
          />
          {activeField && <FieldCard field={activeField} />}
        </Stack>
      ) : (
        <Stack gap="sm">
          {fields.map(f => (
            <FieldCard key={f.slug} field={f} />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
