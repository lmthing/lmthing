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
import { CozyThingText } from '../CozyText'

import '@/css/elements/forms/button/index.css'
import '@/css/elements/forms/input/index.css'
import '@/css/elements/content/card/index.css'
import '@/css/elements/overlays/dialog/index.css'

const WORKSPACE_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16']

type DemoWorkspace = {
  id: string
  name: string
  slug: string
  description: string
}

type DemoWorkspaceIndexItem = {
  name: string
  description?: string
  subject_id?: string
  workspace_id?: string
}

type Workspace = {
  id: string
  name: string
  color: string
}

function workspaceToSlug(name: string): string {
  return encodeURIComponent(name)
}

export default function LandingLayout() {
  const router = useRouter()
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false)

  const { login, logout, isAuthenticated, isLoadingAuth } = useGithub()
  const [searchQuery, setSearchQuery] = useState('')
  const [demoWorkspaces, setDemoWorkspaces] = useState<DemoWorkspace[]>([])

  useEffect(() => {
    let isMounted = true

    const loadDemoWorkspaces = async () => {
      try {
        const response = await fetch('/demos/index.json')
        if (!response.ok) {
          throw new Error(`Failed to load demos index: ${response.status}`)
        }

        const items = (await response.json()) as DemoWorkspaceIndexItem[]

        if (!isMounted) return

        const mapped = items.map((item) => {
          const slug = item.workspace_id || item.subject_id || item.name
          return {
            id: slug,
            slug,
            name: `local/${slug}`,
            description: item.description || `${item.name} workspace`,
          }
        })

        setDemoWorkspaces(mapped)
      } catch (error) {
        console.error('Failed to load demo workspaces index:', error)
      }
    }

    void loadDemoWorkspaces()

    return () => {
      isMounted = false
    }
  }, [])

  const availableWorkspaces = useMemo(() => {
    const workspaces: Workspace[] = []

    demoWorkspaces.forEach((mock, idx) => {
      workspaces.push({
        id: mock.id,
        name: mock.name,
        color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
      })
    })

    return workspaces
  }, [demoWorkspaces])

  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery) return availableWorkspaces.slice(0, 5)
    const query = searchQuery.toLowerCase()
    return availableWorkspaces.filter(w => w.name.toLowerCase().includes(query))
  }, [availableWorkspaces, searchQuery])

  const openWorkspaceModal = () => {
    setIsWorkspaceModalOpen(true)
  }

  const handleWorkspaceSelect = (workspace: Workspace) => {
    setIsWorkspaceModalOpen(false)
    router.push(`/workspace/${workspaceToSlug(workspace.name)}/studio`)
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-semibold truncate">lm<CozyThingText text="thing" /></h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild>
                <Link href="/marketplace">Marketplace</Link>
              </Button>
              <Button size="sm" onClick={openWorkspaceModal}>
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
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
              The <CozyThingText text="THING" className="inline-block text-lg font-bold align-baseline" /> is an orchestrator that coordinates your specialized AI assistants across workspaces&mdash;each with their own knowledge, tools, and workflows.
            </p>
          </div>

          {/* THING Feature Panel */}
          <div className="mx-auto mt-14 max-w-5xl rounded-3xl border-2 border-violet-300/30 bg-gradient-to-br from-violet-50/50 via-white to-violet-50/50 p-8 shadow-xl dark:border-violet-500/20 dark:from-violet-950/10 dark:via-slate-900 dark:to-violet-950/10">
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  One <CozyThingText text="THING" className="inline-block text-3xl font-bold tracking-tight sm:text-4xl" />, many experts
                </h3>
                <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
                  Think of the <CozyThingText text="THING" className="inline-block text-lg font-bold align-baseline" /> as a project manager for your AI team. Each workspace holds specialists with their own knowledge and tools.
                </p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-slate-900">
                  <FileText className="size-8 text-emerald-600 mb-2" />
                  <h4 className="font-semibold text-slate-700 dark:text-slate-100">Workspaces Hold Knowledge</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Each workspace stores domain knowledge as organized documents&mdash;the ground truth for its specialists.
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm dark:border-violet-900/40 dark:from-violet-950/20 dark:to-slate-900">
                  <Bot className="size-8 text-violet-600 mb-2" />
                  <h4 className="font-semibold text-slate-700 dark:text-slate-100">Workspaces Hold Assistants</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Each workspace contains specialized assistants with their own prompts, tools, and configurations.
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm dark:border-blue-900/40 dark:from-blue-950/20 dark:to-slate-900">
                  <Workflow className="size-8 text-blue-600 mb-2" />
                  <h4 className="font-semibold text-slate-700 dark:text-slate-100">THING Coordinates Them All</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Ask the THING anything&mdash;it routes your request to the right assistants and synthesizes the results.
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-center">
                <Button size="lg" className="shadow-lg" onClick={openWorkspaceModal}>
                  Get started with <CozyThingText text="THING" className="inline-block text-lg font-bold align-baseline" />
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="mt-12">
            <h3 className="text-center text-2xl font-semibold">How the <CozyThingText text="THING" className="inline-block text-2xl font-semibold" /> Works</h3>
            <p className="mx-auto mt-2 max-w-2xl text-center text-slate-600 dark:text-slate-400">
              Build your team of AI specialists in four steps
            </p>
            <div className="mt-12 grid gap-8 lg:grid-cols-4">
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                    <FileText className="size-8" />
                  </div>
                  <span className="mt-4 text-sm font-semibold text-violet-600">Step 1</span>
                  <h4 className="mt-2 text-lg font-semibold">Create Workspaces</h4>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Set up workspaces for each domain and organize your knowledge into them.
                  </p>
                </div>
              </div>
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                    <Bot className="size-8" />
                  </div>
                  <span className="mt-4 text-sm font-semibold text-violet-600">Step 2</span>
                  <h4 className="mt-2 text-lg font-semibold">Build Specialists</h4>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Each workspace gets specialized assistants with their own prompts, tools, and knowledge access.
                  </p>
                </div>
              </div>
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                    <Workflow className="size-8" />
                  </div>
                  <span className="mt-4 text-sm font-semibold text-violet-600">Step 3</span>
                  <h4 className="mt-2 text-lg font-semibold">Design Workflows</h4>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Chain multiple steps into workflows that your assistants can execute autonomously.
                  </p>
                </div>
              </div>
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-violet-600 text-white">
                    <Play className="size-8" />
                  </div>
                  <span className="mt-4 text-sm font-semibold text-violet-600">Step 4</span>
                  <h4 className="mt-2 text-lg font-semibold">Ask the THING</h4>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Tell the <CozyThingText text="THING" /> what you need&mdash;it routes to the right specialists and returns synthesized results.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Marketplace Section */}
          <section className="mx-auto mt-12 max-w-5xl rounded-2xl border bg-white dark:bg-slate-900 p-4 sm:p-8 overflow-hidden">
            <div>
              <div className="w-full text-center">
                <h3 className="text-2xl font-semibold text-center">Marketplace</h3>
                <p className="mt-2 max-w-2xl mx-auto text-slate-600 dark:text-slate-400 text-center">
                  Browse ready-to-use demo workspaces and open them instantly in Studio.
                </p>
              </div>

              <div className="mt-8 overflow-x-auto pb-2 pt-2">
                <div className="flex min-w-max gap-4">
                  {demoWorkspaces.map((workspace, idx) => (
                    <button
                      key={workspace.id}
                      type="button"
                      onClick={() => handleWorkspaceSelect({
                        id: workspace.id,
                        name: workspace.name,
                        color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
                      })}
                      className="w-72 shrink-0 rounded-xl border bg-white dark:bg-slate-900 p-4 text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-violet-300/50"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <div
                          className="flex size-8 items-center justify-center rounded-md text-white"
                          style={{ backgroundColor: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length] }}
                        >
                          <Building2 className="size-4" />
                        </div>
                        <p className="truncate text-sm font-semibold">{workspace.name}</p>
                      </div>
                      <p className="line-clamp-2 min-h-10 text-sm text-slate-600 dark:text-slate-400">{workspace.description}</p>
                      <div className="mt-3 flex items-center justify-end text-violet-600">
                        <ArrowRight className="size-4" />
                      </div>
                    </button>
                  ))}
                  <div className="w-72 shrink-0 rounded-xl border-2 border-dashed border-violet-400/40 bg-violet-50/50 dark:bg-violet-950/20 p-4">
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <p className="text-sm font-semibold">Want more workspaces?</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
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
            <div className="mx-auto max-w-4xl rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 p-8 shadow-lg dark:border-amber-900/40 dark:from-amber-950/20 dark:via-slate-900 dark:to-orange-950/20">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full border-2 border-amber-500/40 bg-amber-100/80 px-4 py-2 text-sm font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <FileText className="size-5" />
                  Grounded in Your Knowledge
                </div>
                <h3 className="mt-4 text-3xl font-bold tracking-tight">
                  Each Workspace Knows Its Domain
                </h3>
                <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                  Your workspaces contain the ground truth. When the THING routes a task to a specialist, that assistant only sees relevant knowledge&mdash;no hallucinations, no context rot.
                </p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-amber-200 bg-white/60 p-5 dark:border-amber-900/30 dark:bg-slate-900/40">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                      <FileText className="size-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-100">Transparent Knowledge</h4>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Every fact lives in plain markdown documents. Read, verify, and update them easily.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-orange-200 bg-white/60 p-5 dark:border-orange-900/30 dark:bg-slate-900/40">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/40">
                      <Bot className="size-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-100">Specialists Use What They Know</h4>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Assistants only reference documents from their workspace. The THING ensures each specialist gets only relevant context.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-white/60 p-5 dark:border-amber-900/30 dark:bg-slate-900/40">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                      <Brain className="size-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-100">No Context Rot</h4>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        By isolating knowledge per workspace and routing intelligently, the THING keeps each assistant focused.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-white/60 p-5 dark:border-indigo-900/30 dark:bg-slate-900/40">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                      <Sparkles className="size-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-100">Trustworthy Results</h4>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        AI that combines the power of LLMs with the reliability of your own verified knowledge.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Getting Started Section */}
          <div className="mt-20 rounded-2xl bg-slate-100/50 dark:bg-slate-800/30 px-8 py-12 text-center">
            <h3 className="text-2xl font-semibold">Build Your AI Team</h3>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Create workspaces, add specialists, and let the THING coordinate them all
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" onClick={openWorkspaceModal}>
                <Settings className="mr-2 size-5" />
                Open Studio
              </Button>
            </div>
          </div>
        </main>

        <Dialog open={isWorkspaceModalOpen} onOpenChange={setIsWorkspaceModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select a Workspace</DialogTitle>
              <DialogDescription>
                Choose a workspace to open in Studio, or search for one.
              </DialogDescription>
            </DialogHeader>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                className="input"
                placeholder="Search or create repository..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredWorkspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => handleWorkspaceSelect(workspace)}
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
                          backgroundColor: `${workspace.color}20`,
                        }}
                      >
                        <Building2 style={{ width: 16, height: 16, color: workspace.color }} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 500 }}>{workspace.name}</p>
                      </div>
                    </div>
                    <ArrowRight style={{ width: 16, height: 16, opacity: 0.5 }} />
                  </button>
                ))}

                {filteredWorkspaces.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', opacity: 0.6 }}>No workspaces found matching &quot;{searchQuery}&quot;</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <footer className="mt-20 border-t bg-slate-50/50 dark:bg-slate-900/50">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
              <p>&copy; {new Date().getFullYear()} lmthing. Turn Knowledge into LLM Engineers.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
