import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, Settings } from 'lucide-react'
import { Button } from '@/elements/forms/button'
import { Card, CardHeader, CardBody } from '@/elements/content/card'
import { useAuth } from '@/lib/auth/useAuth'

import '@/css/elements/forms/button/index.css'
import '@/css/elements/content/card/index.css'

import themeData from '@/theme.json'

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
  const router = useRouter()
  const { username } = useAuth()
  const [demoSpaces, setDemoSpaces] = useState<DemoSpace[]>([])
  const defaultStudioId = 'default'

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

  const handleSpaceSelect = (space: { id: string; name: string }) => {
    const user = username || 'local'
    router.push(`/${encodeURIComponent(user)}/${encodeURIComponent(defaultStudioId)}/${encodeURIComponent(space.name)}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted to-background">
      <header className="border-b bg-background/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">lmthing</h1>
          </Link>
          <Button variant="outline" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-16">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight">Marketplace</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Explore pre-configured spaces and open them directly in Studio.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {demoSpaces.map((space, idx) => (
              <Card
                key={space.id}
                interactive
                className="cursor-pointer"
                onClick={() => handleSpaceSelect(space)}
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
                    variant="outline"
                    style={{ width: '100%' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSpaceSelect(space)
                    }}
                  >
                    <Settings style={{ width: 16, height: 16, marginRight: '0.5rem' }} />
                    Open
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
