'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth/useAuth'
import { useApp } from '../../../../org/state/src'
import { demoToFileTree } from '@/lib/demoToFileTree'
import type { DemoWorkspaceData } from '@/lib/demoToFileTree'

const PERSONAL_STUDIO_ID = 'personal'
const PERSONAL_STUDIO_NAME = 'Personal'
const DEMO_URL = '/demos/app-navigator.json'

export function SystemStudioBootstrap({ children }: { children: React.ReactNode }) {
  const { username, isAuthenticated } = useAuth()
  const { studios, createStudio, importStudio, isLoading } = useApp()
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !username || isLoading || bootstrappedRef.current) return

    const hasPersonalStudio = studios.some(
      s => s.username === username && s.studioId === PERSONAL_STUDIO_ID
    )

    if (hasPersonalStudio) {
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

        // Create the personal studio
        createStudio(username!, PERSONAL_STUDIO_ID, PERSONAL_STUDIO_NAME)

        // Convert demo JSON to flat file tree
        const rawFiles = demoToFileTree(data)

        // Re-prefix files from {demoId}/... to system/{demoId}/...
        const spaceId = `system/${data.id}`
        const oldPrefix = `${data.id}/`
        const files: Record<string, string> = {}
        for (const [path, content] of Object.entries(rawFiles)) {
          if (path.startsWith(oldPrefix)) {
            files[`system/${path}`] = content
          } else {
            files[path] = content
          }
        }

        // Update lmthing.json to register the system space
        const configRaw = JSON.stringify({
          id: PERSONAL_STUDIO_ID,
          name: PERSONAL_STUDIO_NAME,
          version: '1.0.0',
          spaces: {
            [spaceId]: {
              name: spaceId,
              description: `System space: ${data.id}`,
              system: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
          settings: {},
        }, null, 2)

        importStudio(username!, PERSONAL_STUDIO_ID, {
          'lmthing.json': configRaw,
          ...files,
        })
      } catch (error) {
        console.error('Failed to bootstrap personal studio:', error)
      }
    }

    void bootstrap()
  }, [isAuthenticated, username, studios, isLoading, createStudio, importStudio])

  return <>{children}</>
}
