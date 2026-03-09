import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Building2, Download, Check, Loader2 } from 'lucide-react'
import { Button } from '@/elements/forms/button'
import { Card, CardHeader, CardBody } from '@/elements/content/card'
import { useAuth } from '@/lib/auth/useAuth'
import { useApp } from '@lmthing/state'
import { demoToFileTree } from '@/lib/demoToFileTree'
import type { DemoWorkspaceData } from '@/lib/demoToFileTree'
import { buildSpacePath } from '@/lib/space-url'

import '@/css/elements/forms/button/index.css'
import '@/css/elements/content/card/index.css'

import themeData from '@/theme.json'
import { CozyThingText } from '@/CozyText'

const SPACE_COLORS = themeData.colors.brand

type DemoSpace = {
  id: string
  name: string
  slug: string
  description: string
}

type DemoSpaceIndexItem = {
  name: string
  description?: string
  subject_id?: string
  workspace_id?: string
}

export default function MarketplaceLayout() {
  const navigate = useNavigate()
  const { username } = useAuth()
  const { studios, appFS, createStudio, importStudio } = useApp()
  const [demoSpaces, setDemoSpaces] = useState<DemoSpace[]>([])
  const [installedSpaces, setInstalledSpaces] = useState<Set<string>>(new Set())
  const [installingSpace, setInstallingSpace] = useState<string | null>(null)
  const [studioPickerSpace, setStudioPickerSpace] = useState<DemoSpace | null>(null)

  const user = username || 'local'

  const userStudios = studios.filter(s => s.username === user)

  useEffect(() => {
    let isMounted = true

    const loadDemoSpaces = async () => {
      try {
        const response = await fetch('/demos/index.json')
        if (!response.ok) {
          throw new Error(`Failed to load demos index: ${response.status}`)
        }

        const items = (await response.json()) as DemoSpaceIndexItem[]

        if (!isMounted) return

        const mapped = items.map((item) => {
          const slug = item.workspace_id || item.subject_id || item.name
          return {
            id: slug,
            slug,
            name: `local/${slug}`,
            description: item.description || `${item.name} space`,
          }
        })

        setDemoSpaces(mapped)
      } catch (error) {
        console.error('Failed to load demo spaces index:', error)
      }
    }

    void loadDemoSpaces()

    return () => {
      isMounted = false
    }
  }, [])

  async function installSpaceToStudio(space: DemoSpace, studioId: string) {
    const studioKey = `${user}/${studioId}`
    const configContent = appFS.readFile(`${studioKey}/lmthing.json`)

    if (!configContent) return

    try {
      const config = JSON.parse(configContent)
      const spaceId = `local/${space.slug}`

      // Check if space already exists
      if (config.spaces[spaceId]) {
        navigate({ to: buildSpacePath(user, studioId, spaceId) })
        return
      }

      setInstallingSpace(space.id)

      // Fetch the demo JSON for this space
      const response = await fetch(`/demos/${space.slug}.json`)
      if (!response.ok) {
        throw new Error(`Failed to fetch demo: ${response.status}`)
      }
      const data = (await response.json()) as DemoWorkspaceData

      // Convert demo JSON to flat file tree
      const rawFiles = demoToFileTree(data)

      // Re-prefix files from {demoId}/... to local/{demoId}/...
      const oldPrefix = `${data.id}/`
      const files: Record<string, string> = {}
      for (const [path, content] of Object.entries(rawFiles)) {
        if (path.startsWith(oldPrefix)) {
          files[`local/${path}`] = content
        } else {
          files[path] = content
        }
      }

      // Register the space in lmthing.json
      config.spaces[spaceId] = {
        name: spaceId,
        description: space.description || `Marketplace space: ${space.slug}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Import files + updated config into the studio
      importStudio(user, studioId, {
        'lmthing.json': JSON.stringify(config, null, 2),
        ...files,
      })

      setInstalledSpaces(prev => new Set(prev).add(space.id))
      setInstallingSpace(null)

      navigate({ to: buildSpacePath(user, studioId, spaceId) })
    } catch (e) {
      console.error('Failed to install space:', e)
      setInstallingSpace(null)
    }
  }

  function handleInstall(space: DemoSpace) {
    if (installingSpace) return
    if (userStudios.length === 0) {
      // No studios — create a default one and install there
      createStudio(user, 'default', 'Default Studio')
      void installSpaceToStudio(space, 'default')
    } else if (userStudios.length === 1) {
      void installSpaceToStudio(space, userStudios[0].studioId)
    } else {
      setStudioPickerSpace(space)
    }
  }

  function handleStudioSelect(studioId: string) {
    if (!studioPickerSpace) return
    const space = studioPickerSpace
    setStudioPickerSpace(null)
    void installSpaceToStudio(space, studioId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted to-background">
      <header className="border-b bg-background/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <h1 className="text-xl font-semibold"><CozyThingText text="lmthing" /></h1>
          </Link>
          <Button variant="outline" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-16">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight">Marketplace</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Explore pre-configured spaces and install them into your studio.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {demoSpaces.map((space, idx) => {
              const isInstalled = installedSpaces.has(space.id)
              const isInstalling = installingSpace === space.id
              return (
                <Card
                  key={space.id}
                  interactive
                  className="cursor-pointer"
                  onClick={() => handleInstall(space)}
                  style={{ padding: 0 }}
                >
                  <CardHeader style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div
                        style={{
                          width: '3rem',
                          height: '3rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '0.75rem',
                          color: 'white',
                          backgroundColor: SPACE_COLORS[idx % SPACE_COLORS.length],
                        }}
                      >
                        <Building2 style={{ width: 24, height: 24 }} />
                      </div>
                      <ArrowRight style={{ width: 20, height: 20, opacity: 0.4, transition: 'transform 0.2s' }} />
                    </div>
                    <h3 style={{ marginTop: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>{space.name}</h3>
                    <p style={{ fontSize: '0.875rem', opacity: 0.6, marginTop: '0.25rem' }}>{space.description}</p>
                  </CardHeader>
                  <CardBody style={{ padding: '0 1.25rem 1.25rem' }}>
                    <Button
                      size="sm"
                      variant={isInstalled ? 'outline' : 'primary'}
                      style={{ width: '100%' }}
                      disabled={isInstalling}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleInstall(space)
                      }}
                    >
                      {isInstalling ? (
                        <>
                          <Loader2 style={{ width: 16, height: 16, marginRight: '0.5rem', animation: 'spin 1s linear infinite' }} />
                          Installing...
                        </>
                      ) : isInstalled ? (
                        <>
                          <Check style={{ width: 16, height: 16, marginRight: '0.5rem' }} />
                          Installed
                        </>
                      ) : (
                        <>
                          <Download style={{ width: 16, height: 16, marginRight: '0.5rem' }} />
                          Install
                        </>
                      )}
                    </Button>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        </div>
      </main>

      {/* Studio picker modal */}
      {studioPickerSpace && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}>
          <div style={{
            background: 'var(--color-bg)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            maxWidth: '28rem',
            width: '100%',
            border: '1px solid var(--color-border)',
          }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Select Studio
            </h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '1rem' }}>
              Choose which studio to install <strong>{studioPickerSpace.name}</strong> into.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {userStudios.map((studio) => (
                <button
                  key={studio.studioId}
                  className="btn btn--ghost"
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    padding: '0.75rem 1rem',
                  }}
                  onClick={() => handleStudioSelect(studio.studioId)}
                >
                  {studio.name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn--ghost" onClick={() => setStudioPickerSpace(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
