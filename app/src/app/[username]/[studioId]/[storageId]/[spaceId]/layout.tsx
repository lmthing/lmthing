'use client'

import { use } from 'react'
import { SpaceProvider } from '@/lib/contexts/SpaceContext'
import { StudioLayout } from '@/components/shell/studio-layout'
import { buildFullSpaceId } from '@/lib/space-url'

/**
 * Space layout - mounts SpaceContext (SpaceFS scope).
 * Renders the StudioShell with sidebar via StudioLayout.
 */
export default function SpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ username: string; studioId: string; storageId: string; spaceId: string }>
}) {
  const { storageId, spaceId } = use(params)
  const fullSpaceId = buildFullSpaceId(storageId, spaceId)
  return (
    <SpaceProvider spaceId={fullSpaceId}>
      <StudioLayout>{children}</StudioLayout>
    </SpaceProvider>
  )
}
