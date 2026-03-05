'use client'

import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { useKnowledgeFields } from '@/hooks/useKnowledgeFields'
import { Badge } from '@/elements/content/badge'
import { Stack } from '@/elements/layouts/stack'

/**
 * Knowledge field tree page.
 */
export default function KnowledgePage() {
  const fields = useKnowledgeFields()

  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Knowledge</Heading>
      <Caption muted style={{ marginBottom: '1rem' }}>
        {fields.length} knowledge field{fields.length !== 1 ? 's' : ''} configured.
      </Caption>
      <Stack gap="sm">
        {fields.map(f => (
          <Badge key={f.id} variant="muted">{f.id}</Badge>
        ))}
      </Stack>
    </div>
  )
}
