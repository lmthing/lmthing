'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth/useAuth'
import { useApp } from '@lmthing/state'
import { demoToFileTree } from '@/lib/demoToFileTree'
import type { DemoWorkspaceData } from '@/lib/demoToFileTree'

const SYSTEM_STUDIO_ID = 'system'
const SYSTEM_STUDIO_NAME = 'System'
const DEMO_URL = '/demos/app-navigator.json'

export function SystemStudioBootstrap({ children }: { children: React.ReactNode }) {
  const { username, isAuthenticated } = useAuth()
  const { studios, createStudio, importStudio, isLoading } = useApp()
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !username || isLoading || bootstrappedRef.current) return

    const hasSystemStudio = studios.some(
      s => s.username === username && s.studioId === SYSTEM_STUDIO_ID
    )

    if (hasSystemStudio) {
      bootstrappedRef.current = true
      return
    }

    bootstrappedRef.current = true

    async function bootstrap() {
      try {
        const response = await fetch(DEMO_URL)
        if (!response.ok) {
          console.error(`Failed to fetch demo: ${response.status}`)
          return
        }

        const data = (await response.json()) as DemoWorkspaceData

        // Create the System studio
        createStudio(username!, SYSTEM_STUDIO_ID, SYSTEM_STUDIO_NAME)

        // Convert demo JSON to flat file tree and import into the studio
        const files = demoToFileTree(data)

        // Also update lmthing.json to register the space
        const configRaw = JSON.stringify({
          id: SYSTEM_STUDIO_ID,
          name: SYSTEM_STUDIO_NAME,
          version: '1.0.0',
          spaces: {
            [data.id]: {
              name: data.packageJson?.name ?? data.id,
              description: `Demo space: ${data.id}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
          settings: {
            defaultSpace: data.id,
          },
        }, null, 2)

        importStudio(username!, SYSTEM_STUDIO_ID, {
          'lmthing.json': configRaw,
          ...files,
        })
      } catch (error) {
        console.error('Failed to bootstrap System studio:', error)
      }
    }

    void bootstrap()
  }, [isAuthenticated, username, studios, isLoading, createStudio, importStudio])

  return <>{children}</>
}
