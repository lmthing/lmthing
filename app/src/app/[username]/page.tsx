'use client'

import { use } from 'react'
import { StudiosLayout } from '@/components/shell/studios-layout'

export default function StudioListPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  return <StudiosLayout />
}
