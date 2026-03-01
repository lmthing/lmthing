import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  Settings,
  FileText,
  Workflow,
  Play,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { workspaceToSlug, type Workspace } from './components/WorkspaceSelector'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { GithubLoginButton } from '@/components/GithubLoginButton'
import { useGithub } from '@/lib/github/GithubContext'
import { useWorkspaceDataContext } from '@/lib/workspaceContext'
import { useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { toWorkspaceName } from '@/lib/workspaces'
import logo from '@/assets/logo.png'

const WORKSPACE_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16']

// Mock workspaces from extracted_data_structure.json
const MOCK_WORKSPACES = [
  { id: 'education', name: 'local/education', slug: 'education', description: 'Learning and tutoring agents' },
  { id: 'plants', name: 'local/plants', slug: 'plants', description: 'Indoor plant care coaching' },
  { id: 'web-development', name: 'local/web-development', slug: 'web-development', description: 'React and web component building' },
]

export default function LandingLayout() {
  const navigate = useNavigate()
  const { data: githubWorkspaces, isLoading } = useWorkspaces()
  const { workspaces: jsonWorkspaces } = useWorkspaceDataContext()
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false)

  const { octokit, user, addSelectedWorkspaceRepo } = useGithub()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Combine mock workspaces and GitHub workspaces
  const availableWorkspaces = useMemo(() => {
    const workspaces: Workspace[] = []

    // Add mock workspaces first
    MOCK_WORKSPACES.forEach((mock, idx) => {
      workspaces.push({
        id: mock.id,
        name: mock.name,
        color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
        description: mock.description,
      })
    })

    // Add GitHub workspaces
    if (githubWorkspaces) {
      githubWorkspaces.forEach((repo) => {
        // Avoid duplicates
        if (!workspaces.find(w => w.name === repo.name)) {
          workspaces.push({
            id: repo.id.toString(),
            name: repo.name,
            color: WORKSPACE_COLORS[workspaces.length % WORKSPACE_COLORS.length],
          })
        }
      })
    }

    return workspaces
  }, [githubWorkspaces])

  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery) return availableWorkspaces.slice(0, 5)
    const query = searchQuery.toLowerCase()
    return availableWorkspaces.filter(w => w.name.toLowerCase().includes(query))
  }, [availableWorkspaces, searchQuery])

  const derivedRepoName = useMemo(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed) return ''

    if (trimmed.includes('%')) {
      const parts = trimmed.split('%')
      return parts.slice(1).join('%').trim()
    }

    if (trimmed.includes('/')) {
      const parts = trimmed.split('/')
      return parts.slice(1).join('/').trim()
    }

    return trimmed
  }, [searchQuery])

  const handleCreateWorkspace = async () => {
    if (!octokit || !user || !derivedRepoName) return
    setIsCreating(true)
    try {
      const { data } = await octokit.rest.repos.createForAuthenticatedUser({
        name: derivedRepoName,
        private: true,
        auto_init: true
      })
      await addSelectedWorkspaceRepo(toWorkspaceName(data.owner.login, data.name))
      await queryClient.invalidateQueries({ queryKey: ['github-workspaces'] })
      handleWorkspaceSelect({
        id: data.id.toString(),
        name: toWorkspaceName(data.owner.login, data.name),
        color: WORKSPACE_COLORS[0],
      })
    } catch (e) {
      console.error(e)
      alert("Failed to create repository. It might already exist or you don't have permissions.")
    } finally {
      setIsCreating(false)
    }
  }

  const openWorkspaceModal = () => {
    setIsWorkspaceModalOpen(true)
  }

  const handleWorkspaceSelect = (workspace: Workspace) => {
    setIsWorkspaceModalOpen(false)
    navigate(`/workspace/${workspaceToSlug(workspace.name)}/studio`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="lmthing" className="size-8" />
            <h1 className="text-xl font-semibold">lmthing</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-sm text-muted-foreground mr-2">Your expertise, amplified by AI</span>
            <GithubLoginButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Turn Knowledge into AI Agents
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No code required. Transform your knowledge into powerful AI agents.
            Organize them into knowledge areas, design workflows visually, and deploy
            intelligent solutions — all without writing a single line of code.
          </p>
        </div>

        {/* Studio Launch Panel */}
        <div className="mx-auto mt-14 max-w-4xl rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Settings className="size-3.5" />
                Studio
              </div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Build, test, and run everything in one place
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Studio is now your full workflow: shape knowledge, configure agents, design flows,
                and validate runtime behavior without leaving the workspace.
              </p>
            </div>
            <Button size="lg" className="sm:self-start" onClick={openWorkspaceModal}>
              Open Studio
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
              <span className="font-medium">Knowledge</span>
              <span className="text-slate-500 dark:text-slate-400"> → markdown-driven context</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
              <span className="font-medium">Agents</span>
              <span className="text-slate-500 dark:text-slate-400"> → forms, prompts, and tools</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
              <span className="font-medium">Runtime</span>
              <span className="text-slate-500 dark:text-slate-400"> → in-studio conversations</span>
            </div>
          </div>
        </div>

        {/* Demo Workspaces Section */}
        <div id="demo-workspaces" className="mt-16">
          <h3 className="text-center text-2xl font-semibold">Demo Workspaces</h3>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Explore pre-configured workspaces to see how AI agents work
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {MOCK_WORKSPACES.map((workspace, idx) => (
              <Card
                key={workspace.id}
                className="group cursor-pointer border-2 transition-all hover:border-primary/50 hover:shadow-lg"
                onClick={() => handleWorkspaceSelect({
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
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleWorkspaceSelect({
                          id: workspace.id,
                          name: workspace.name,
                          color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
                        } as Workspace)
                      }}
                    >
                      <Settings className="mr-2 size-4" />
                      Open
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>


        {/* How It Works Section */}
        <div className="mt-20">
          <h3 className="text-center text-2xl font-semibold">How It Works</h3>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Build AI agents in four simple steps — from knowledge to action
          </p>
          <div className="mt-12 grid gap-8 lg:grid-cols-4">
            {/* Step 1 */}
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileText className="size-8" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary">Step 1</span>
                </div>
                <h4 className="mt-2 text-lg font-semibold">Organize Your Knowledge</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Structure your knowledge into markdown files in a file tree. Create
                  folders, documents, and links that mirror your field's natural organization.
                </p>
              </div>
              <div className="hidden lg:block absolute right-0 top-8 -translate-y-1/2 translate-x-1/2 text-muted-foreground/30">
                <ArrowRight className="size-6" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Bot className="size-8" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary">Step 2</span>
                </div>
                <h4 className="mt-2 text-lg font-semibold">Build Your Agent</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use the Agent Builder to create a configurable AI agent. Connect it to your
                  knowledge, set its personality, and define how it should respond.
                </p>
              </div>
              <div className="hidden lg:block absolute right-0 top-8 -translate-y-1/2 translate-x-1/2 text-muted-foreground/30">
                <ArrowRight className="size-6" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Workflow className="size-8" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary">Step 3</span>
                </div>
                <h4 className="mt-2 text-lg font-semibold">Add Task Flows</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create actions as task flows that your agent can execute. Define step-by-step
                  actions using the visual flow editor — no coding required.
                </p>
              </div>
              <div className="hidden lg:block absolute right-0 top-8 -translate-y-1/2 translate-x-1/2 text-muted-foreground/30">
                <ArrowRight className="size-6" />
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Play className="size-8" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary-foreground">Step 4</span>
                </div>
                <h4 className="mt-2 text-lg font-semibold">Run & Execute in Studio</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Test your agent directly inside Studio conversations. Watch it run actions,
                  perform tasks, and leverage your knowledge in real-time.
                </p>
              </div>
            </div>
          </div>

          {/* Mobile connector arrows */}
          <div className="mt-8 flex justify-center lg:hidden">
            <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
              <ArrowRight className="size-6 rotate-90" />
            </div>
          </div>
        </div>

        {/* Getting Started Section */}
        <div className="mt-20 rounded-2xl bg-muted/50 px-8 py-12 text-center">
          <h3 className="text-2xl font-semibold">Start Building Your AI Agents</h3>
          <p className="mt-2 text-muted-foreground">
            Your knowledge is all you need — no coding required
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" onClick={openWorkspaceModal}>
              <Settings className="mr-2 size-5" />
              Build in Studio
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={isWorkspaceModalOpen} onOpenChange={setIsWorkspaceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Demo Workspace</DialogTitle>
            <DialogDescription>
              Choose a workspace to open Studio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              placeholder="Search or create repository..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
            />
            {isLoading && <div className="text-center text-sm p-4 text-muted-foreground">Loading repositories...</div>}

            <div className="max-h-[300px] overflow-y-auto grid gap-2">
              {filteredWorkspaces.map((workspace: Workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => handleWorkspaceSelect(workspace)}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex size-8 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${workspace.color}20` }}
                    >
                      <Building2 className="size-4" style={{ color: workspace.color }} />
                    </div>
                    <div>
                      <p className="font-medium truncate max-w-[180px]">{workspace.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">/{workspace.name}</p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                </button>
              ))}

              {!isLoading && filteredWorkspaces.length === 0 && (
                <div className="text-center p-4">
                  <p className="text-sm text-muted-foreground mb-3">No repositories found matching "{searchQuery}"</p>
                </div>
              )}
            </div>

            {!searchQuery && availableWorkspaces.length > 5 && (
              <p className="text-xs text-center text-muted-foreground mt-1">
                Showing recent {Math.min(5, availableWorkspaces.length)} of {availableWorkspaces.length}. Search to see more.
              </p>
            )}

            {searchQuery && !filteredWorkspaces.find(w => w.name.toLowerCase() === searchQuery.toLowerCase()) && (
              <Button
                onClick={handleCreateWorkspace}
                className="w-full mt-2"
                disabled={isCreating || !derivedRepoName}
              >
                {isCreating ? 'Creating...' : `Create "${derivedRepoName}"`}
              </Button>
            )}

            {!isLoading && availableWorkspaces.length === 0 && !searchQuery && (
              <div className="text-center text-sm p-4 text-muted-foreground">No repositories found. Type to create one.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-20 border-t py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
          <p>lmthing — Turn Knowledge into LLM Engineers</p>
        </div>
      </footer>
    </div>
  )
}
