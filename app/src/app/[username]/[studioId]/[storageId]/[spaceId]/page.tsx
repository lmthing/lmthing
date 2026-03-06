'use client'

import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

/**
 * Space overview page - default view when entering a space.
 */
export default function SpaceOverviewPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Space Overview</Heading>
      <Caption muted>Select an assistant, workflow, or knowledge area from the sidebar.</Caption>
    </div>
  )
}
