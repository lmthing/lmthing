import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { workspaceToSlug, type Workspace } from './components/WorkspaceSelector'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import logo from '@/assets/logo.png'

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
}

export default function MarketplaceLayout() {
  const navigate = useNavigate()
  const { loadLocalDemoWorkspace } = useWorkspaceData()
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
          const slug = item.subject_id || item.name
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

  const handleWorkspaceSelect = async (workspace: Workspace) => {
    if (workspace.name.startsWith('local/')) {
      const localWorkspaceId = workspace.name.slice('local/'.length)
      if (localWorkspaceId) {
        try {
          await loadLocalDemoWorkspace(localWorkspaceId)
        } catch {
          return
        }
      }
    }

    navigate(`/workspace/${workspaceToSlug(workspace.name)}/studio`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <header className="border-b bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="lmthing" className="size-10" />
            <h1 className="text-xl font-semibold">lmthing</h1>
          </Link>
          <Button variant="outline" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-16">
        <div id="demo-workspaces">
          <h2 className="text-center text-3xl font-bold tracking-tight">Marketplace</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Explore pre-configured workspaces and open them directly in Studio.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {demoWorkspaces.map((workspace, idx) => (
              <Card
                key={workspace.id}
                className="group cursor-pointer border-2 transition-all hover:border-primary/50 hover:shadow-lg"
                onClick={() => void handleWorkspaceSelect({
                  id: workspace.id,
                  name: workspace.name,
                  color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
                } as Workspace)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div
                      className="flex size-12 items-center justify-center rounded-xl text-white transition-colors"
                      style={{ backgroundColor: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length] }}
                    >
                      <Building2 className="size-6" />
                    </div>
                    <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                  <CardTitle className="mt-4 text-xl">{workspace.name}</CardTitle>
                  <CardDescription>{workspace.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleWorkspaceSelect({
                        id: workspace.id,
                        name: workspace.name,
                        color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
                      } as Workspace)
                    }}
                  >
                    <Settings className="mr-2 size-4" />
                    Open
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}