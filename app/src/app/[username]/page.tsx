'use client'

import { use } from 'react'
import { SpacesLayout } from '@/components/shell/spaces-layout'

export default function StudioListPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  return <SpacesLayout />
}
