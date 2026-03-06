'use client'

import { use } from 'react'
import { ThingPanel } from '@/components/thing/thing-panel'

export default function ThingPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  return <ThingPanel fullPage />
}
