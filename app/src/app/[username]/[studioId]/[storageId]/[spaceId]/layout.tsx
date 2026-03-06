'use client'

import { use } from 'react'
import { SpaceProvider } from '@/lib/contexts/SpaceContext'
import { StudioLayout } from '@/components/shell/studio-layout'

/**
 * Space layout - mounts SpaceContext (SpaceFS scope).
 * Renders the StudioShell with sidebar via StudioLayout.
 */
export default function SpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ username: string; studioId: string; spaceId: string }>
}) {
  const { spaceId } = use(params)
  return (
    <SpaceProvider spaceId={decodeURIComponent(spaceId)}>
      <StudioLayout>{children}</StudioLayout>
    </SpaceProvider>
  )
}
