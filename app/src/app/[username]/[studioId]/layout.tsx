'use client'

import { use } from 'react'
import { StudioProvider } from '@/lib/contexts/StudioContext'

/**
 * Studio layout - mounts StudioContext (StudioFS scope).
 */
export default function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ username: string; studioId: string }>
}) {
  const { studioId } = use(params)
  return <StudioProvider>{children}</StudioProvider>
}
