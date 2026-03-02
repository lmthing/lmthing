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
  Download,
  Check,
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
import { GithubStars } from '@/components/GithubStars'
import { GithubDeploymentStatus } from '@/components/GithubDeploymentStatus'
import { useGithub } from '@/lib/github/GithubContext'
import { useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { toWorkspaceName } from '@/lib/workspaces'
import { ThingPanel } from './components/ThingPanel'
import { extractAllWorkspaces } from '@/lib/extractWorkspaceData'
import logo from '@/assets/logo.png'

// Load all workspace data using import.meta.glob
const demoFiles = import.meta.glob('@/demos/**/*.{md,json}', {
  eager: true,
  as: 'raw',
})

// Normalize paths by removing the '@/demos/' prefix
const normalizedDemoFiles: Record<string, string> = {}
for (const [key, value] of Object.entries(demoFiles)) {
  const normalizedKey = key.replace(/^\/src\/demos\//, '').replace(/^@\/demos\//, '')
  normalizedDemoFiles[normalizedKey] = value as string
}

const WORKSPACE_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16']

// Dynamically discover demo workspaces from filesystem
const demoPackages = import.meta.glob<{ name: string; description: string }>('../demos/*/package.json', { eager: true, import: 'default' })

// Friendly descriptions for demo workspaces
const WORKSPACE_DESCRIPTIONS: Record<string, string> = {
  education: 'Learning and tutoring agents',
  plants: 'Indoor plant care coaching',
  'web-development': 'React and web component building',
  feline: 'Cat care and behavior guidance',
}

// Generate mock workspaces from discovered demos
const MOCK_WORKSPACES = Object.keys(demoPackages)
  .map(path => {
    const match = path.match(/\.\.\/demos\/([^/]+)\/package\.json/)
    if (!match) return null
    const slug = match[1]
    return {
      id: slug,
      name: `local/${slug}`,
      slug,
      description: WORKSPACE_DESCRIPTIONS[slug] || `${slug.charAt(0).toUpperCase() + slug.slice(1)} workspace`,
    }
  })
  .filter(Boolean) as Array<{ id: string; name: string; slug: string; description: string }>

export default function LandingLayout() {
  const navigate = useNavigate()
  const { data: githubWorkspaces, isLoading } = useWorkspaces()
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false)

  const { octokit, user, addSelectedWorkspaceRepo } = useGithub()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdatingStorage, setIsUpdatingStorage] = useState(false)
  const [storageUpdateStatus, setStorageUpdateStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Combine mock workspaces and GitHub workspaces
  const availableWorkspaces = useMemo(() => {
    const workspaces: Workspace[] = []

    // Add mock workspaces first
    MOCK_WORKSPACES.forEach((mock, idx) => {
      workspaces.push({
        id: mock.id,
        name: mock.name,
        color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
      } as Workspace)
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

  const handleUpdateStorageWithExtractedData = async () => {
    try {
      setIsUpdatingStorage(true)
      const WORKSPACE_DATA_STORAGE_KEY = 'lmthing-workspace-data'
      const extractedData = extractAllWorkspaces(normalizedDemoFiles)
      window.localStorage.setItem(WORKSPACE_DATA_STORAGE_KEY, JSON.stringify(extractedData))
      setStorageUpdateStatus('success')
      setTimeout(() => setStorageUpdateStatus('idle'), 3000)
    } catch (error) {
      console.error('Failed to update localStorage:', error)
      setStorageUpdateStatus('error')
      setTimeout(() => setStorageUpdateStatus('idle'), 3000)
    } finally {
      setIsUpdatingStorage(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="lmthing" className="size-12" />
            <h1 className="text-xl font-semibold">lmthing</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-sm text-muted-foreground mr-2">Your expertise, amplified by AI</span>
            <div className="hidden sm:block">
              <GithubStars repo="lmthing/lmthing" />
            </div>
            <GithubLoginButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Build Your Own AI Assistants
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Let THING automatically generate knowledge bases and AI agents from your instructions.
            Simply describe what you want, and THING will create the complete workspace structure,
            agents, and flows — all powered by AI. No manual setup required.
          </p>
        </div>

        {/* THING Feature Panel */}
        <div className="mx-auto mt-14 max-w-5xl rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-white to-violet-50/50 p-8 shadow-xl backdrop-blur-sm dark:border-primary/40 dark:from-primary/10 dark:via-slate-900 dark:to-violet-950/30">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border-2 border-primary/40 bg-primary/20 px-4 py-2 text-sm font-bold text-primary shadow-sm">
                <Bot className="size-5" />
                THING — Your AI Workspace Builder
              </div>
              <h3 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Describe it. THING builds it.
              </h3>
              <p className="mt-3 max-w-3xl mx-auto text-base text-muted-foreground sm:text-lg">
                THING is your AI assistant that creates complete knowledge bases and agents automatically.
                Just tell THING what you need, and it will generate the workspace structure, knowledge files,
                agents, and action flows — ready to use.
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-slate-900">
                <FileText className="size-8 text-emerald-600 mb-2" />
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">Build Your Wisdom Hub</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  THING creates structured knowledge bases with markdown files organized by topic
                </p>
              </div>
              <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm dark:border-violet-900/40 dark:from-violet-950/20 dark:to-slate-900">
                <Bot className="size-8 text-violet-600 mb-2" />
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">Build Smart Agents</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  THING generates agents with proper prompts, tools, and configurations automatically
                </p>
              </div>
              <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm dark:border-blue-900/40 dark:from-blue-950/20 dark:to-slate-900">
                <Workflow className="size-8 text-blue-600 mb-2" />
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">Create Action Flows</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  THING designs complete workflows and task sequences based on your needs
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <Settings className="size-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    First Step: Link Your AI Helper
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Before THING can work its magic, you need to add at least one AI provider (like OpenAI, Anthropic, or others) 
                    in your environment settings. This gives THING the AI power it needs to generate everything for you.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-center">
              <Button size="lg" className="shadow-lg" onClick={openWorkspaceModal}>
                Get Started with THING
                <ArrowRight className="ml-2 size-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Demo Workspaces Section */}
        <div id="demo-workspaces" className="mt-16">
          <h3 className="text-center text-2xl font-semibold">Demo Workspaces</h3>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Explore pre-configured workspaces to see how AI agents work
          </p>
          <div className="mt-6 flex justify-center">
            <Button
              size="sm"
              variant={storageUpdateStatus === 'success' ? 'default' : 'outline'}
              onClick={handleUpdateStorageWithExtractedData}
              disabled={isUpdatingStorage}
              className="gap-2"
            >
              {storageUpdateStatus === 'success' ? (
                <>
                  <Check className="size-4" />
                  Data Loaded
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Load Demo Data
                </>
              )}
            </Button>
          </div>
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
                <h4 className="mt-2 text-lg font-semibold">Watch it Go to Work</h4>
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

        {/* Grounded AI Section */}
        <div className="mt-20">
          <div className="mx-auto max-w-4xl rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 p-8 shadow-lg dark:border-emerald-900/40 dark:from-emerald-950/20 dark:via-slate-900 dark:to-teal-950/20">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-500/40 bg-emerald-100/80 px-4 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <FileText className="size-5" />
                Grounded AI
              </div>
              <h3 className="mt-4 text-3xl font-bold tracking-tight">
                You're Always in Control
              </h3>
              <p className="mt-4 text-lg text-muted-foreground">
                When LLMs work with structured, human-reviewable knowledge fragments instead of 
                generating everything from scratch, they stay grounded in verifiable facts. Your 
                knowledge files become the source of truth — facts over fiction.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-white/60 p-5 dark:border-emerald-900/30 dark:bg-slate-900/40">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                    <FileText className="size-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                      Reviewable Knowledge Base
                    </h4>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Every fact, instruction, and response template lives in a markdown file 
                      that you can read, verify, and update. No hidden "black box" generation.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-white/60 p-5 dark:border-emerald-900/30 dark:bg-slate-900/40">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
                    <Bot className="size-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                      Constrained to Truth
                    </h4>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Agents reference your curated knowledge instead of making things up. 
                      When uncertainty arises, they cite sources or admit limitations.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-white/60 p-5 dark:border-emerald-900/30 dark:bg-slate-900/40">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                    <svg className="size-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                      Version-Controlled Expertise
                    </h4>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Track changes to your knowledge over time. Collaborate with teammates 
                      using Git workflows. Every claim is auditable.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-white/60 p-5 dark:border-emerald-900/30 dark:bg-slate-900/40">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
                    <svg className="size-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                      Rapid Iteration
                    </h4>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Spot an incorrect response? Update the knowledge file and the agent 
                      immediately reflects the fix. No model retraining needed.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/30 dark:bg-amber-950/30">
              <p className="text-center text-sm text-slate-700 dark:text-slate-300">
                <strong>The Result:</strong> AI that's both powerful and trustworthy — combining the flexibility 
                of LLMs with the reliability of human-curated knowledge.
              </p>
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
      <footer className="mt-20 border-t bg-slate-50/50 dark:bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand Column */}
            <div className="col-span-full sm:col-span-1 lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src={logo} alt="lmthing" className="size-8" />
                <span className="text-lg font-semibold">lmthing</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your expertise, amplified by AI. Build knowledge-driven agents without coding.
              </p>
            </div>

            {/* Product Column */}
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#demo-workspaces" className="hover:text-foreground transition-colors">
                    Demo Workspaces
                  </a>
                </li>
                <li>
                  <button onClick={openWorkspaceModal} className="hover:text-foreground transition-colors">
                    Get Started
                  </button>
                </li>
                <li>
                  <a href="https://github.com/lmthing/lmthing#readme" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                    Documentation
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources Column */}
            <div>
              <h4 className="font-semibold mb-3">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="https://github.com/lmthing/lmthing" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                    GitHub Repository
                  </a>
                </li>
                <li>
                  <a href="https://github.com/lmthing/lmthing/issues" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                    Report Issues
                  </a>
                </li>
                <li>
                  <a href="https://github.com/lmthing/lmthing/discussions" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                    Community
                  </a>
                </li>
              </ul>
            </div>

            {/* Connect Column */}
            <div>
              <h4 className="font-semibold mb-3">Connect</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="https://github.com/lmthing/lmthing" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-2">
                    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
              <p>© {new Date().getFullYear()} lmthing. Turn Knowledge into LLM Engineers.</p>
              <div className="flex items-center gap-4">
                <div className="sm:hidden">
                  <GithubStars repo="lmthing/lmthing" />
                </div>
                <GithubDeploymentStatus 
                  repo="lmthing/lmthing" 
                  workflowName="Deploy to GitHub Pages"
                  branch="main"
                />
                <div className="flex items-center gap-6">
                  <a href="https://github.com/lmthing/lmthing/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                    License
                  </a>
                  <a href="https://github.com/lmthing/lmthing" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                    Terms
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
      </div>
      
      {/* ThingPanel - collapsed by default */}
      <ThingPanel />
    </div>
  )
}
