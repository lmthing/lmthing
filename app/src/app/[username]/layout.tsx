'use client'

import { StudioProvider } from '@/lib/contexts/StudioContext'

/**
 * Username layout - UserFS scope.
 * Wraps children with StudioProvider so components like SpacesLayout
 * can safely use useStudio (returns empty state when no studio is selected).
 */
export default function UsernameLayout({ children }: { children: React.ReactNode }) {
  return <StudioProvider>{children}</StudioProvider>
}
