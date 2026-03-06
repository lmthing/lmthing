import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bot,
  Settings,
  FileText,
  Workflow,
  Play,
  Building2,
  Sparkles,
  Brain,
} from 'lucide-react'
import { Button } from '@/elements/forms/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/elements/overlays/dialog'
import { useGithub } from '@/lib/github/GithubContext'
import { useAuth } from '@/lib/auth/useAuth'
import { buildSpacePath } from '@/lib/space-url'
import { CozyThingText } from '../CozyText'

import '@/css/elements/forms/button/index.css'
import '@/css/elements/forms/input/index.css'
import '@/css/elements/content/card/index.css'
import '@/css/elements/overlays/dialog/index.css'

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

type Space = {
  id: string
  name: string
  color: string
}


export default function LandingLayout() {
  const router = useRouter()
  const { username } = useAuth()
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false)

  const { login, logout, isAuthenticated, isLoadingAuth } = useGithub()
  const [searchQuery, setSearchQuery] = useState('')
  const [demoSpaces, setDemoSpaces] = useState<DemoSpace[]>([])

  // Default studio ID for the current user
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

  const availableSpaces = useMemo(() => {
    const spaces: Space[] = []

    demoSpaces.forEach((mock, idx) => {
      spaces.push({
        id: mock.id,
        name: mock.name,
        color: SPACE_COLORS[idx % SPACE_COLORS.length],
      })
    })

    return spaces
  }, [demoSpaces])

  const filteredSpaces = useMemo(() => {
    if (!searchQuery) return availableSpaces.slice(0, 5)
    const query = searchQuery.toLowerCase()
    return availableSpaces.filter(s => s.name.toLowerCase().includes(query))
  }, [availableSpaces, searchQuery])

  const goToStudios = () => {
    const user = username || 'local'
    router.push(`/${encodeURIComponent(user)}`)
  }

  const openSpaceModal = () => {
    setIsSpaceModalOpen(true)
  }

  const handleSpaceSelect = (space: Space) => {
    setIsSpaceModalOpen(false)
    const user = username || 'local'
    router.push(buildSpacePath(user, defaultStudioId, space.name))
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-gradient-to-b from-muted to-background">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b bg-background/50 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-semibold truncate"><CozyThingText text="lmthing" /></h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild>
                <Link href="/marketplace">Marketplace</Link>
              </Button>
              <Button size="sm" onClick={openSpaceModal}>
                Open Studio
              </Button>
              <button
                onClick={() => { if (isLoadingAuth) return; if (isAuthenticated) { logout(); return; } void login().catch(console.error) }}
                disabled={isLoadingAuth}
                className="btn btn--ghost btn--sm"
              >
                {isLoadingAuth ? 'Loading...' : isAuthenticated ? 'Logout' : 'Login with GitHub'}
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="w-full mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Your personal <CozyThingText text="THING" className="inline-block text-4xl font-bold tracking-tight sm:text-5xl" />
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              The <CozyThingText text="THING" className="inline-block text-lg font-bold align-baseline" /> is an orchestrator that coordinates your specialized AI assistants across spaces&mdash;each with their own knowledge, tools, and workflows.
            </p>
          </div>

          {/* THING Feature Panel */}
          <div className="mx-auto mt-14 max-w-5xl rounded-3xl border-2 border-brand-3/20 bg-gradient-to-br from-brand-3/10 via-background to-brand-3/10 p-8 shadow-xl">
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  One <CozyThingText text="THING" className="inline-block text-3xl font-bold tracking-tight sm:text-4xl" />, many experts
                </h3>
                <p className="mt-3 text-lg text-muted-foreground">
                  Think of the <CozyThingText text="THING" className="inline-block text-lg font-bold align-baseline" /> as a project manager for your AI team. Each space holds specialists with their own knowledge and tools.
                </p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border-2 border-brand-2/30 bg-gradient-to-br from-brand-2/10 to-background p-4 shadow-sm">
                  <FileText className="size-8 text-brand-2 mb-2" />
                  <h4 className="font-semibold text-foreground">Spaces Hold Knowledge</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Each space stores field knowledge as organized documents&mdash;the ground truth for its specialists.
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-brand-3/30 bg-gradient-to-br from-brand-3/10 to-background p-4 shadow-sm">
                  <Bot className="size-8 text-brand-3 mb-2" />
                  <h4 className="font-semibold text-foreground">Spaces Hold Assistants</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Each space contains specialized assistants with their own prompts, tools, and configurations.
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-brand-4/30 bg-gradient-to-br from-brand-4/10 to-background p-4 shadow-sm">
                  <Workflow className="size-8 text-brand-4 mb-2" />
                  <h4 className="font-semibold text-foreground">THING Coordinates Them All</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ask the THING anything&mdash;it routes your request to the right assistants and synthesizes the results.
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-center">
                <Button size="lg" className="shadow-lg" onClick={goToStudios}>
                  Get started with <CozyThingText text="THING" className="inline-block text-lg font-bold align-baseline" />
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="mt-12">
            <h3 className="text-center text-2xl font-semibold">How the <CozyThingText text="THING" className="inline-block text-2xl font-semibold" /> Works</h3>
            <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
              Build your team of AI specialists in four steps
            </p>
            <div className="mt-12 grid gap-8 lg:grid-cols-4">
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-3/15 text-brand-3">
                    <FileText className="size-8" />
                  </div>
                  <span className="mt-4 text-sm font-semibold text-brand-3">Step 1</span>
                  <h4 className="mt-2 text-lg font-semibold">Create Spaces</h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Set up spaces for each field and organize your knowledge into them.
                  </p>
                </div>
              </div>
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-3/15 text-brand-3">
                    <Bot className="size-8" />
                  </div>
                  <span className="mt-4 text-sm font-semibold text-brand-3">Step 2</span>
                  <h4 className="mt-2 text-lg font-semibold">Build Specialists</h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Each space gets specialized assistants with their own prompts, tools, and knowledge access.
                  </p>
                </div>
              </div>
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-3/15 text-brand-3">
                    <Workflow className="size-8" />
                  </div>
                  <span className="mt-4 text-sm font-semibold text-brand-3">Step 3</span>
                  <h4 className="mt-2 text-lg font-semibold">Design Workflows</h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Chain multiple steps into workflows that your assistants can execute autonomously.
                  </p>
                </div>
              </div>
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-3 text-white">
                    <Play className="size-8" />
                  </div>
                  <span className="mt-4 text-sm font-semibold text-brand-3">Step 4</span>
                  <h4 className="mt-2 text-lg font-semibold">Ask the THING</h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tell the <CozyThingText text="THING" /> what you need&mdash;it routes to the right specialists and returns synthesized results.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Marketplace Section */}
          <section className="mx-auto mt-12 max-w-5xl rounded-2xl border bg-card p-4 sm:p-8 overflow-hidden">
            <div>
              <div className="w-full text-center">
                <h3 className="text-2xl font-semibold text-center">Marketplace</h3>
                <p className="mt-2 max-w-2xl mx-auto text-muted-foreground text-center">
                  Browse ready-to-use demo spaces and open them instantly in Studio.
                </p>
              </div>

              <div className="mt-8 overflow-x-auto pb-2 pt-2">
                <div className="flex min-w-max gap-4">
                  {demoSpaces.map((space, idx) => (
                    <button
                      key={space.id}
                      type="button"
                      onClick={() => handleSpaceSelect({
                        id: space.id,
                        name: space.name,
                        color: SPACE_COLORS[idx % SPACE_COLORS.length],
                      })}
                      className="w-72 shrink-0 rounded-xl border bg-card p-4 text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-brand-3/30"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <div
                          className="flex size-8 items-center justify-center rounded-md text-white"
                          style={{ backgroundColor: SPACE_COLORS[idx % SPACE_COLORS.length] }}
                        >
                          <Building2 className="size-4" />
                        </div>
                        <p className="truncate text-sm font-semibold">{space.name}</p>
                      </div>
                      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{space.description}</p>
                      <div className="mt-3 flex items-center justify-end text-brand-3">
                        <ArrowRight className="size-4" />
                      </div>
                    </button>
                  ))}
                  <div className="w-72 shrink-0 rounded-xl border-2 border-dashed border-brand-3/30 bg-brand-3/10 p-4">
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <p className="text-sm font-semibold">Want more spaces?</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Discover the full catalog in Marketplace.
                      </p>
                      <Button size="sm" className="mt-4" asChild>
                        <Link href="/marketplace">
                          Show more
                          <ArrowRight className="ml-2 size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Knowledge Section */}
          <div className="mt-20">
            <div className="mx-auto max-w-4xl rounded-2xl border-2 border-brand-2/30 bg-gradient-to-br from-brand-2/10 via-background to-brand-3/10 p-8 shadow-lg">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full border-2 border-brand-2/30 bg-brand-2/15 px-4 py-2 text-sm font-bold text-brand-2">
                  <FileText className="size-5" />
                  Grounded in Your Knowledge
                </div>
                <h3 className="mt-4 text-3xl font-bold tracking-tight">
                  Each Space Knows Its Field
                </h3>
                <p className="mt-4 text-lg text-muted-foreground">
                  Your spaces contain the ground truth. When the THING routes a task to a specialist, that assistant only sees relevant knowledge&mdash;no hallucinations, no context rot.
                </p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-brand-2/30 bg-background/60 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-2/15">
                      <FileText className="size-5 text-brand-2" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Transparent Knowledge</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Every fact lives in plain markdown documents. Read, verify, and update them easily.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-brand-3/30 bg-background/60 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-3/15">
                      <Bot className="size-5 text-brand-3" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Specialists Use What They Know</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Assistants only reference documents from their space. The THING ensures each specialist gets only relevant context.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-brand-2/30 bg-background/60 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-2/15">
                      <Brain className="size-5 text-brand-2" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">No Context Rot</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        By isolating knowledge per space and routing intelligently, the THING keeps each assistant focused.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-brand-3/30 bg-background/60 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-3/15">
                      <Sparkles className="size-5 text-brand-3" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Trustworthy Results</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        AI that combines the power of LLMs with the reliability of your own verified knowledge.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Getting Started Section */}
          <div className="mt-20 rounded-2xl bg-muted/50 px-8 py-12 text-center">
            <h3 className="text-2xl font-semibold">Build Your AI Team</h3>
            <p className="mt-2 text-muted-foreground">
              Create studios, add specialists, and let the THING coordinate them all
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" onClick={goToStudios}>
                <Settings className="mr-2 size-5" />
                My Studios
              </Button>
            </div>
          </div>
        </main>

        <Dialog open={isSpaceModalOpen} onOpenChange={setIsSpaceModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select a Space</DialogTitle>
              <DialogDescription>
                Choose a space to open in Studio, or search for one.
              </DialogDescription>
            </DialogHeader>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                className="input"
                placeholder="Search or create space..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredSpaces.map((space) => (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => handleSpaceSelect(space)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      padding: '0.75rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '2rem',
                          height: '2rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '0.375rem',
                          backgroundColor: `${space.color}20`,
                        }}
                      >
                        <Building2 style={{ width: 16, height: 16, color: space.color }} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 500 }}>{space.name}</p>
                      </div>
                    </div>
                    <ArrowRight style={{ width: 16, height: 16, opacity: 0.5 }} />
                  </button>
                ))}

                {filteredSpaces.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', opacity: 0.6 }}>No spaces found matching &quot;{searchQuery}&quot;</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <footer className="mt-20 border-t bg-muted/50">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
              <p>&copy; {new Date().getFullYear()} lmthing. Turn Knowledge into LLM Engineers.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
