'use client'

import { use, useEffect } from 'react'
import { useApp } from '@lmthing/state'
import { StudioProvider } from '@/lib/contexts/StudioContext'

/**
 * Studio layout - mounts StudioContext (StudioFS scope).
 * Syncs URL params to AppContext's currentStudioKey so StudioFS is properly scoped.
 */
export default function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ username: string; studioId: string }>
}) {
  const { username, studioId } = use(params)
  const { currentStudioKey, setCurrentStudio } = useApp()

  useEffect(() => {
    const expectedKey = `${username}/${studioId}`
    if (currentStudioKey !== expectedKey) {
      setCurrentStudio(username, studioId)
    }
  }, [username, studioId, currentStudioKey, setCurrentStudio])

  return <StudioProvider>{children}</StudioProvider>
}
