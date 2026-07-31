import type { ComponentType } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Blocks,
  Bot,
  Braces,
  FolderOpen,
  FolderTree,
  GitBranch,
  Globe,
  Mail,
  Monitor,
  MonitorPlay,
  Package,
  Plug,
  Radio,
  ShieldCheck,
  Smartphone,
  TerminalSquare,
  Wallet,
  Waypoints,
  Zap,
} from 'lucide-react'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

export const Route = createFileRoute('/')({
  component: Landing,
})

const services: {
  name: string
  tagline: string
  description: string
  color: string
  icon: React.ReactNode
  upcoming?: boolean
}[] = [
  {
    name: 'lmthing.chat',
    tagline: 'Your personal THING',
    description:
      'One agent that answers, and builds. Send it files, images or your voice — it writes the app, the agents and the automations while you talk.',
    color: 'var(--brand-2)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0m0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0m0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0m0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25" />
      </svg>
    ),
  },
  {
    name: 'lmthing.app',
    tagline: 'The apps it builds for you',
    description:
      'Ask for a planner, a tracker, a workspace. You get a real app — schema, typed endpoints, UI — served at its own clean URL, with your data inside.',
    color: 'var(--brand-3)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25zm9.75 0a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25zM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18zm9.75 0a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 15.75V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18z" />
      </svg>
    ),
  },
  {
    name: 'lmthing.studio',
    tagline: 'Author agents by hand',
    description:
      'Open any agent, space or project and edit it yourself — instructions, knowledge, functions, tasklists. Everything the AI wrote is yours to change.',
    color: 'var(--brand-1)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128m0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
      </svg>
    ),
  },
  {
    name: 'lmthing.computer',
    tagline: 'Your pod, in a browser',
    description:
      'Files, terminals and a runtime dashboard over the machine your agents live on. Real compute, real files, nothing to set up.',
    color: 'var(--spectrum-12)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25" />
      </svg>
    ),
  },
  {
    name: 'lmthing.team',
    tagline: 'A workspace that pays for itself',
    description:
      'Channels, DMs and shared projects for real colleagues — with its own runtime, subscription and credentials. THING is in the threads with you.',
    color: 'var(--spectrum-28)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25" />
      </svg>
    ),
  },
  {
    name: 'lmthing.store',
    tagline: 'Install apps and agents',
    description:
      'Whole apps, agent spaces and integrations, installable into your own pod in a click. They arrive as files you own and can edit.',
    color: 'var(--spectrum-8)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75" />
      </svg>
    ),
  },
  {
    name: 'lmthing.space',
    tagline: 'Directory and admin',
    description:
      'Every space you own in one place, each with an owner dashboard: agents, pages, database, users, logs and a terminal.',
    color: 'var(--brand-4)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0" />
      </svg>
    ),
  },
  {
    name: 'lmthing.social',
    tagline: 'Public hive mind',
    description:
      'Share agents and conversations publicly. Explore what the community is building and remix ideas in real time.',
    color: 'var(--spectrum-18)',
    upcoming: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0m6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0m-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0" />
      </svg>
    ),
  },
  {
    name: 'lmthing.blog',
    tagline: 'AI news, personalized',
    description:
      'Your daily AI briefing, curated by agents that learn what you care about. Never miss what matters.',
    color: 'var(--brand-5)',
    upcoming: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5" />
      </svg>
    ),
  },
  {
    name: 'lmthing.casa',
    tagline: 'AI-powered smart home',
    description:
      'Connect your THING to Home Assistant and control your home with natural language. Automations that actually understand you.',
    color: 'var(--spectrum-38)',
    upcoming: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
]

const SANDBOX_SNIPPET = `const overdue = await db.query('tasks', { status: 'open' })
for (const t of overdue.filter(isLate)) {
  await notify(t.owner, \`"\${t.title}" slipped\`)
}
display(<Summary items={overdue} />)`

const SPACE_TREE = `newsroom/
├── agents/researcher/
│   ├── charter.md      # who it is
│   └── instruct.md     # its wiring + instructions
├── functions/          # plain TypeScript — no LLM
├── knowledge/          # loaded on demand, not every turn
├── tasklists/          # DAG workflows, step by step
├── components/         # the UI it renders back to you
└── events/             # webhook · cron · db · internal`

interface FeatureItem {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  description: string
}

interface FeatureGroup {
  key: string
  label: string
  tagline: string
  color: string
  items: FeatureItem[]
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    key: 'build',
    label: 'Build',
    tagline: 'Describe it, and it gets built — with a real backend behind it.',
    color: 'var(--brand-3)',
    items: [
      {
        icon: Blocks,
        title: 'Apps with a real backend',
        description:
          'A database schema, typed API endpoints checked before they save, and a UI built against them — then an acceptance pass that asks whether the app is actually right.',
      },
      {
        icon: Bot,
        title: 'Agents that build agents',
        description:
          'THING writes new specialists, forks itself to work in parallel, and delegates to agents with narrower powers than its own — one that only touches schemas, one with a throwaway sandbox.',
      },
      {
        icon: ShieldCheck,
        title: 'Capabilities, not permissions',
        description:
          'An agent without a grant does not get "access denied" — the function is absent from its world entirely. No generic filesystem on any agent surface, ever.',
      },
    ],
  },
  {
    key: 'desktop',
    label: 'Desktop',
    tagline: 'A native app for the two things a browser tab can never give an agent.',
    color: 'var(--spectrum-12)',
    items: [
      {
        icon: MonitorPlay,
        title: 'A browser you and your agent share',
        description:
          'A real browser view inside the desktop app: one page, one login, one scroll position. You watch it; the agent clicks, types and reads it. Nothing to download.',
      },
      {
        icon: FolderOpen,
        title: 'Your local files',
        description:
          'Point the desktop app at a folder and your agent can work on what is actually on your machine. Nothing is reachable until you name it, and disconnect is a kill switch.',
      },
    ],
  },
  {
    key: 'cli',
    label: 'CLI',
    tagline: 'The whole runtime, portable as one file.',
    color: 'var(--brand-1)',
    items: [
      {
        icon: Package,
        title: 'One file, no install',
        description:
          'The whole runtime as a single executable — CLI, REST API, WebSocket and agents — on a machine with no Node and no checkout. A coding agent is bundled inside it.',
      },
    ],
  },
  {
    key: 'mobile',
    label: 'Mobile',
    tagline: 'The same app, natively.',
    color: 'var(--spectrum-28)',
    items: [
      {
        icon: Smartphone,
        title: 'On your phone, in your pocket',
        description:
          'Push notifications sent only by your own pod, over-the-air updates, drafts, message editing and an honest offline state.',
      },
    ],
  },
  {
    key: 'automate',
    label: 'Automate',
    tagline: 'Reach the outside world, and let it wake your agents.',
    color: 'var(--brand-4)',
    items: [
      {
        icon: Radio,
        title: 'Events, webhooks and cron',
        description:
          'A space can declare what it emits — a webhook arrives, a schedule fires, a row changes — and hooks wake your agents to deal with it. Automations that run while you sleep.',
      },
      {
        icon: Plug,
        title: 'Integrations you own',
        description:
          'Slack, Telegram, email and more, each a self-contained space installed from the store with your own token. No broker in the middle holding your access.',
      },
      {
        icon: Globe,
        title: 'It can read the web',
        description:
          'Search and page-fetch backed by a real headless browser, so JavaScript-heavy pages are readable — plus images, transcribed audio, spreadsheets and office documents.',
      },
    ],
  },
  {
    key: 'platform',
    label: 'Platform',
    tagline: 'The infrastructure underneath, so you never have to think about it.',
    color: 'var(--brand-5)',
    items: [
      {
        icon: Waypoints,
        title: 'Every model, one endpoint',
        description: 'An OpenAI-compatible API in front of every model we route to. Point your existing code at it and it just works.',
      },
      {
        icon: Wallet,
        title: 'Budgets, not surprise bills',
        description:
          'Rolling daily, weekly and monthly spend caps on every account. A request is refused when a window is exhausted — there is no overage to discover later.',
      },
      {
        icon: Zap,
        title: 'Costs nothing while you are away',
        description:
          'Your pod scales to zero and is woken by the edge on any request, in about a second, with real boot progress on screen. Scheduled jobs still fire while it sleeps.',
      },
      {
        icon: Mail,
        title: 'Sign in with an email address',
        description:
          'A six-digit code or a magic link that signs in the browser that asked for it and nobody else. GitHub too. No password to choose, leak or reset.',
      },
      {
        icon: GitBranch,
        title: 'Your workspace is a git repo',
        description:
          'Back the whole thing up to your own GitHub repository. Version control, history and diffs over everything your agents wrote.',
      },
    ],
  },
]

const clients: { name: string; detail: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { name: 'Web', detail: 'chat, studio, computer and your apps in any browser', icon: Globe },
  { name: 'Desktop', detail: 'macOS, Windows and Linux — plus local files and the shared browser', icon: Monitor },
  { name: 'Phone', detail: 'the same app natively, with push and over-the-air updates', icon: Smartphone },
  { name: 'Terminal', detail: 'one downloadable file, no Node and no checkout required', icon: TerminalSquare },
]

const jumpLinks = [
  { href: '#surfaces', label: 'Surfaces' },
  { href: '#features', label: 'Features' },
  { href: '#clients', label: 'Clients' },
  { href: '#pricing', label: 'Pricing' },
]

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:py-36">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-[0.08] blur-3xl"
            style={{
              background: `radial-gradient(circle, var(--brand-1), var(--brand-3), var(--brand-5))`,
            }}
          />
        </div>

        <div className="mx-auto max-w-4xl text-center animate-fade-in-up">
          <h1 className="text-5xl sm:text-7xl tracking-tight">
            <CozyThingText text="lmthing" className="text-5xl sm:text-7xl" />
          </h1>
          <p className="mt-6 text-xl sm:text-2xl text-muted-foreground leading-relaxed animate-fade-in-up-delay">
            The open platform for building, running and sharing AI agents.
            <br className="hidden sm:block" />
            Describe what you want. It writes the agents, the app and the automations — and hands
            you the files.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4 animate-fade-in-up-delay-2">
            <Link
              to="/signup"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get started free
            </Link>
            <Link
              to="/pricing"
              className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              View pricing
            </Link>
          </div>

          {/* Wayfinding */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-2 animate-fade-in-up-delay-3">
            {jumpLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* The two ideas */}
      <section className="px-6 py-20 sm:py-28 border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl tracking-tight">Two ideas, and everything follows</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Not another wrapper around a chat box. A different execution model, and a format you
              can actually read.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-card p-7">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--brand-3) 12%, transparent)', color: 'var(--brand-3)' }}
                >
                  <Braces className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-3)' }}>
                  The runtime
                </span>
              </div>
              <h3 className="mt-4 text-xl font-semibold">The model writes code, not tool calls</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                One TypeScript statement at a time, streamed, evaluated as it arrives inside a
                WebAssembly sandbox. That means real loops, real conditionals, real variables — one
                turn does work a tool-calling loop spends ten round-trips on. Generated code is
                typechecked <em>before</em> it is saved, so mistakes are caught in the writer instead
                of at 2am in production.
              </p>
              <pre className="mt-5 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
                <code>{SANDBOX_SNIPPET}</code>
              </pre>
            </div>

            <div className="rounded-xl border border-border bg-card p-7">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--brand-4) 12%, transparent)', color: 'var(--brand-4)' }}
                >
                  <FolderTree className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-4)' }}>
                  The format
                </span>
              </div>
              <h3 className="mt-4 text-xl font-semibold">An agent is not a prompt. It is a folder.</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Every agent is a directory you can read, diff, edit by hand, commit to git, publish
                and install. Its frontmatter <em>is</em> its wiring — which functions it may call,
                what it may know, what it may render, who it may delegate to — and every reference is
                checked when the space loads. Nothing important is hidden in a prompt string in a
                database.
              </p>
              <pre className="mt-5 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
                <code>{SPACE_TREE}</code>
              </pre>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            The same is true of an app: a project is <code className="text-foreground">database/</code>{' '}
            <code className="text-foreground">api/</code> <code className="text-foreground">pages/</code>{' '}
            <code className="text-foreground">components/</code> <code className="text-foreground">hooks/</code>{' '}
            <code className="text-foreground">events/</code> on disk —{' '}
            <a
              href="https://lmthing.org/format"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              the whole format is documented
            </a>
            .
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section id="surfaces" className="scroll-mt-20 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16 animate-fade-in-up-delay-3">
            <h2 className="text-3xl sm:text-4xl tracking-tight">
              One <CozyThingText text="thing" className="text-3xl sm:text-4xl" /> for everything
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Interconnected surfaces covering the whole life of an agent — from the first message to
              a running app your team uses every day.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((service, i) => (
              <div
                key={service.name}
                className={`group relative rounded-xl border border-border bg-card p-6 hover:border-transparent hover:shadow-lg transition-all duration-300${service.upcoming ? ' opacity-75' : ''}`}
                style={{
                  animationDelay: `${i * 60}ms`,
                  animationName: 'fade-in-up',
                  animationDuration: '600ms',
                  animationFillMode: 'both',
                  animationTimingFunction: 'ease-out',
                }}
              >
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
                  style={{
                    background: `linear-gradient(135deg, ${service.color}08, ${service.color}15)`,
                  }}
                />
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${service.color}40`,
                    borderRadius: 'inherit',
                    pointerEvents: 'none',
                  }}
                />
                {service.upcoming && (
                  <span
                    className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider rounded-full px-2.5 py-0.5"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${service.color} 15%, transparent)`,
                      color: service.color,
                    }}
                  >
                    Coming soon
                  </span>
                )}
                <div className="flex items-start gap-4">
                  <div
                    className="flex-shrink-0 rounded-lg p-2.5"
                    style={{ backgroundColor: `color-mix(in srgb, ${service.color} 12%, transparent)`, color: service.color }}
                  >
                    {service.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">
                      <CozyThingText text={service.name} />
                    </h3>
                    <p className="text-sm font-medium mt-0.5" style={{ color: service.color }}>
                      {service.tagline}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features, grouped */}
      <section id="features" className="scroll-mt-20 px-6 py-20 sm:py-28 border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-6">
            <h2 className="text-3xl sm:text-4xl tracking-tight">Everything it does</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Real infrastructure behind every one of these — not a roadmap.
            </p>
          </div>

          {/* Group nav */}
          <div className="mb-16 flex flex-wrap items-center justify-center gap-2">
            {FEATURE_GROUPS.map((group) => (
              <a
                key={group.key}
                href={`#group-${group.key}`}
                className="rounded-full border px-3.5 py-1 text-xs font-medium transition-opacity hover:opacity-70"
                style={{
                  color: group.color,
                  borderColor: `color-mix(in srgb, ${group.color} 35%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${group.color} 10%, transparent)`,
                }}
              >
                {group.label}
              </a>
            ))}
          </div>

          <div className="space-y-14">
            {FEATURE_GROUPS.map((group) => (
              <div key={group.key} id={`group-${group.key}`} className="scroll-mt-24">
                <div className="mb-6 flex items-baseline gap-3">
                  <span
                    className="text-sm font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: group.color }}
                  >
                    {group.label}
                  </span>
                  <span className="h-px flex-1" style={{ backgroundColor: `color-mix(in srgb, ${group.color} 25%, transparent)` }} />
                  <span className="hidden sm:block text-sm text-muted-foreground text-right">
                    {group.tagline}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {group.items.map((feature) => {
                    const Icon = feature.icon
                    return (
                      <div
                        key={feature.title}
                        className="rounded-xl border border-border bg-card p-6"
                      >
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `color-mix(in srgb, ${group.color} 12%, transparent)`, color: group.color }}
                        >
                          <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                        </span>
                        <h3 className="mt-3.5 font-semibold text-base">{feature.title}</h3>
                        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Clients */}
      <section id="clients" className="scroll-mt-20 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl tracking-tight">Wherever you work</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              One account, one workspace, four ways in. The screens are literally the same code.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {clients.map((client) => {
              const Icon = client.icon
              return (
                <div key={client.name} className="rounded-xl border border-border bg-card p-6 text-center">
                  <span
                    className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <h3 className="mt-3.5 font-semibold text-base">{client.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{client.detail}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section id="pricing" className="scroll-mt-20 px-6 py-20 sm:py-28 border-t border-border">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl tracking-tight">Start free, scale when ready</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A generous free token budget, every model, and your own pod — no credit card. Paid plans
            from $10/month add more memory, more concurrent sessions and jobs that run more often.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              to="/signup"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create your account
            </Link>
            <Link
              to="/pricing"
              className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Compare plans
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-12">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <CozyThingText text="lmthing" className="text-lg" />
            <span className="text-sm text-muted-foreground">
              — open platform for AI agents
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/docs" className="hover:text-foreground transition-colors">Docs</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <a
              href="https://github.com/lmthing/lmthing"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
