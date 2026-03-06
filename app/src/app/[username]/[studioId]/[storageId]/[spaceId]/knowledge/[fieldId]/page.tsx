'use client'

import { use } from 'react'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

/**
 * Knowledge field / subject list page.
 */
export default function FieldDetailPage({
  params,
}: {
  params: Promise<{ fieldId: string }>
}) {
  const { fieldId } = use(params)
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Field: {fieldId}</Heading>
      <Caption muted>Browse subjects and topics within this knowledge field.</Caption>
    </div>
  )
}
