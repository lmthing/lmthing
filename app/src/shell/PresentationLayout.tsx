import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  FileText,
  Workflow,
  Brain,
  Sparkles,
  Layers,
  Zap,
  Users,
  ChevronDown,
} from 'lucide-react'

const GithubIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
)
import { Button } from '@/components/ui/button'
import { CozyThingText } from '../CozyText'
import logo from '@/assets/logo.png'

const SLIDE_SECTIONS = [
  { id: 'hero', label: 'Intro' },
  { id: 'problem', label: 'Problem' },
  { id: 'solution', label: 'Solution' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'demo', label: 'Demo' },
  { id: 'team', label: 'Team' },
] as const

export default function PresentationLayout() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky nav dots */}
      <nav className="fixed right-6 top-1/2 z-50 -translate-y-1/2 hidden lg:flex flex-col gap-3">
        {SLIDE_SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className="group flex items-center gap-2 justify-end"
          >
            <span className="text-xs font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              {s.label}
            </span>
            <span className="size-2.5 rounded-full bg-muted-foreground/40 group-hover:bg-primary transition-colors" />
          </button>
        ))}
      </nav>

      {/* ===== HERO ===== */}
      <section
        id="hero"
        className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative z-10 max-w-4xl">
          <div className="mb-8 flex items-center justify-center gap-3">
            <img src={logo} alt="lmthing" className="size-16" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            lm<CozyThingText text="thing" className="text-5xl font-bold tracking-tight sm:text-7xl" />
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-muted-foreground sm:text-2xl">
            Turn Knowledge into LLM Engineers
          </p>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground/80">
            An open-source orchestrator that coordinates specialized AI assistants across workspaces — each with their own knowledge, tools, and workflows.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/">
                Try it live
                <ArrowRight className="ml-2 size-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://github.com/lmthing/lmthing" target="_blank" rel="noopener noreferrer">
                <GithubIcon className="mr-2 size-5" />
                GitHub
              </a>
            </Button>
          </div>
        </div>
        <button
          onClick={() => scrollTo('problem')}
          className="absolute bottom-10 animate-bounce text-muted-foreground"
        >
          <ChevronDown className="size-8" />
        </button>
      </section>

      {/* ===== PROBLEM ===== */}
      <section
        id="problem"
        className="flex min-h-screen flex-col items-center justify-center px-6 py-20"
      >
        <div className="max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-red-500/40 bg-red-100/80 px-4 py-2 text-sm font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
            <Brain className="size-5" />
            The Problem
          </div>
          <h2 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Why General AI Falls Short
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Generic AI assistants lack your specific expertise. They hallucinate, lose context, and can't coordinate across domains.
          </p>
        </div>

        <div className="mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
          {[
            {
              icon: Bot,
              title: 'Hallucination Risk',
              desc: 'General AI makes up facts confidently. Without your knowledge as ground truth, errors spread unchecked.',
              color: 'red',
            },
            {
              icon: Workflow,
              title: 'Context Rot',
              desc: 'As conversations grow, AI loses focus and forgets critical details. Relevant information gets buried.',
              color: 'rose',
            },
            {
              icon: FileText,
              title: 'No Transparency',
              desc: "You can't inspect what the AI \"knows.\" Black-box models make it impossible to verify their understanding.",
              color: 'orange',
            },
            {
              icon: Sparkles,
              title: "Can't Coordinate Experts",
              desc: "Complex tasks require multiple perspectives. General AI can't delegate to specialists or combine expertise.",
              color: 'amber',
            },
          ].map((item) => (
            <div
              key={item.title}
              className={`rounded-xl border border-${item.color}-200 bg-white/60 p-6 dark:border-${item.color}-900/30 dark:bg-slate-900/40`}
            >
              <item.icon className={`size-8 text-${item.color}-600 dark:text-${item.color}-400 mb-3`} />
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== SOLUTION ===== */}
      <section
        id="solution"
        className="flex min-h-screen flex-col items-center justify-center px-6 py-20"
      >
        <div className="max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-500/40 bg-emerald-100/80 px-4 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Sparkles className="size-5" />
            The Solution
          </div>
          <h2 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            One <CozyThingText text="THING" className="text-4xl font-bold tracking-tight sm:text-5xl" />, Many Experts
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Think of the <CozyThingText text="THING" className="inline-block text-lg font-bold align-baseline" /> as a project manager for your AI team. Each workspace holds specialists with their own knowledge and tools.
          </p>
        </div>

        <div className="mt-12 grid max-w-5xl gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-slate-900">
            <FileText className="size-10 text-emerald-600 mb-3" />
            <h3 className="text-xl font-semibold">Workspaces Hold Knowledge</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Each workspace stores domain knowledge as organized documents — the ground truth for its specialists.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm dark:border-violet-900/40 dark:from-violet-950/20 dark:to-slate-900">
            <Bot className="size-10 text-violet-600 mb-3" />
            <h3 className="text-xl font-semibold">Workspaces Hold Assistants</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Each workspace contains specialized assistants with their own prompts, tools, and configurations.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm dark:border-blue-900/40 dark:from-blue-950/20 dark:to-slate-900">
            <Workflow className="size-10 text-blue-600 mb-3" />
            <h3 className="text-xl font-semibold">THING Coordinates All</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask the THING anything — it routes your request to the right assistants and synthesizes results.
            </p>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section
        id="how-it-works"
        className="flex min-h-screen flex-col items-center justify-center px-6 py-20"
      >
        <div className="max-w-4xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            How the <CozyThingText text="THING" className="text-4xl font-bold tracking-tight sm:text-5xl" /> Works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Build your team of AI specialists in four steps
          </p>
        </div>

        <div className="mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { step: 1, icon: FileText, title: 'Create Workspaces', desc: 'Set up workspaces for each domain and organize your knowledge into them.' },
            { step: 2, icon: Bot, title: 'Build Specialists', desc: 'Each workspace gets specialized assistants with their own prompts and tools.' },
            { step: 3, icon: Workflow, title: 'Design Workflows', desc: 'Chain multiple steps into workflows that assistants execute autonomously.' },
            { step: 4, icon: Zap, title: 'Ask the THING', desc: 'Tell the THING what you need — it routes to the right specialists and synthesizes results.' },
          ].map((item) => (
            <div key={item.step} className="flex flex-col items-center text-center">
              <div className={`flex size-16 items-center justify-center rounded-2xl ${item.step === 4 ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                <item.icon className="size-8" />
              </div>
              <span className="mt-4 text-sm font-semibold text-primary">Step {item.step}</span>
              <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ARCHITECTURE ===== */}
      <section
        id="architecture"
        className="flex min-h-screen flex-col items-center justify-center px-6 py-20"
      >
        <div className="max-w-4xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Architecture</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A lightweight, browser-first platform built for extensibility
          </p>
        </div>

        <div className="mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Layers, title: 'Workspace Isolation', desc: 'Each workspace is a self-contained unit with its own knowledge base, assistants, and environment config.' },
            { icon: Bot, title: 'Multi-Model Support', desc: 'Supports OpenAI, Anthropic, and other providers. Each assistant can use a different model.' },
            { icon: Workflow, title: 'Action Flows', desc: 'Visual workflow editor lets you chain assistant actions into automated pipelines.' },
            { icon: FileText, title: 'GitHub-Backed Storage', desc: 'Workspaces are stored as GitHub repos. Version control built in.' },
            { icon: Zap, title: 'Real-Time Streaming', desc: 'Streaming AI responses with live updates via WebSocket or SSE.' },
            { icon: Users, title: 'Open Source', desc: 'MIT licensed. Fork it, extend it, make it yours.' },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border bg-card p-6">
              <item.icon className="size-8 text-primary mb-3" />
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== DEMO ===== */}
      <section
        id="demo"
        className="flex min-h-screen flex-col items-center justify-center px-6 py-20"
      >
        <div className="max-w-4xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Live Demo</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            See the <CozyThingText text="THING" className="inline-block text-lg font-bold align-baseline" /> in action
          </p>
        </div>

        <div className="mt-12 w-full max-w-5xl rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-16 text-center">
          <p className="text-xl font-semibold text-muted-foreground">Live Demo Area</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Switch to the app to show the demo
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link to="/">
              Open lmthing
              <ArrowRight className="ml-2 size-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ===== TEAM ===== */}
      <section
        id="team"
        className="flex min-h-screen flex-col items-center justify-center px-6 py-20"
      >
        <div className="max-w-4xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">The Team</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built with passion during the hackathon
          </p>
        </div>

        <div className="mt-12 grid max-w-3xl gap-6 sm:grid-cols-3">
          {['Team Member 1', 'Team Member 2', 'Team Member 3'].map((name) => (
            <div key={name} className="flex flex-col items-center text-center">
              <div className="flex size-24 items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground">
                {name.split(' ').map(w => w[0]).join('')}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{name}</h3>
              <p className="text-sm text-muted-foreground">Role</p>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <p className="text-2xl font-bold">
            Thank you!
          </p>
          <p className="mt-2 text-muted-foreground">
            lm<CozyThingText text="thing" className="inline-block text-base font-bold" /> — Turn Knowledge into LLM Engineers
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/">
                Try it now
                <ArrowRight className="ml-2 size-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://github.com/lmthing/lmthing" target="_blank" rel="noopener noreferrer">
                <GithubIcon className="mr-2 size-5" />
                Star on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
