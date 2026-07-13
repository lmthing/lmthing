import type { ComponentType, ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  FolderTree,
  Braces,
  TerminalSquare,
  MessageCircle,
  LayoutGrid,
  MonitorPlay,
  Blocks,
  Cloud,
  Workflow,
  Library,
  Server,
  Palette,
  Globe,
  GitPullRequest,
  BookOpen,
} from 'lucide-react'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'
import { navTree } from '@/lib/docs'

export const Route = createFileRoute('/')({
  component: Landing,
})

const CardLink = Link as unknown as (props: {
  to: string
  className?: string
  children?: ReactNode
}) => ReactNode

interface CardMeta {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  description: string
}

const CARD_META: Record<string, CardMeta> = {
  format: {
    icon: FolderTree,
    description:
      'The on-disk shape of a project and a space — database, api, pages, hooks, events, agents, knowledge and tasklists.',
  },
  'runtime-globals': {
    icon: Braces,
    description:
      'The globals an agent writes against — display, ask, delegate, fork, db, writePage/Api/Hook, installSpace, emitEvent.',
  },
  'cli-api': {
    icon: TerminalSquare,
    description: 'The lmthing CLI commands and every /api/* route the compute pod serves.',
  },
  chat: {
    icon: MessageCircle,
    description: 'The lmthing.chat surface — the conversational interface to the THING agent.',
  },
  studio: {
    icon: LayoutGrid,
    description: 'The lmthing.studio IDE — browse, author and run projects and spaces.',
  },
  computer: {
    icon: MonitorPlay,
    description: 'The lmthing.computer surface — a browser IDE over your pod: files, terminals, runtime dashboard.',
  },
  app: {
    icon: Blocks,
    description: 'How a project-application is served — pages, worker-isolated API, db and hooks on the shared runtime.',
  },
  cloud: {
    icon: Cloud,
    description: 'The gateway and LiteLLM backend — auth, billing, tiers, routes and the render service.',
  },
  runtime: {
    icon: Workflow,
    description: 'The agent runtime — the turn loop, sessions, spaces loading, delegation, forks and tasklists.',
  },
  libs: {
    icon: Library,
    description: 'The shared libraries — state (VFS), ui, css and auth.',
  },
  devops: {
    icon: Server,
    description: 'Infrastructure and deployment — the local dev stack and how surfaces ship to Kubernetes.',
  },
  'design-system': {
    icon: Palette,
    description: 'The token-driven design system — the color tokens and shared components every surface uses.',
  },
  'product-spas': {
    icon: Globe,
    description: 'The product app shells that make up the lmthing.* family of domains.',
  },
  contributing: {
    icon: GitPullRequest,
    description: 'How to extend the platform — adding a runtime global or a new AI provider.',
  },
}

function Landing() {
  const cards = navTree.children.filter(
    (n) => n.children.length > 0 && n.route && CARD_META[n.key],
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 text-center sm:py-28">
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div
            className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.08] blur-3xl"
            style={{ background: 'radial-gradient(circle, var(--brand-1), var(--brand-3), var(--brand-5))' }}
          />
        </div>
        <h1 className="text-4xl tracking-tight sm:text-6xl">
          <CozyThingText text="lmthing.org" className="text-4xl sm:text-6xl" />
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          The developer documentation for the <CozyThingText text="lmthing" /> platform — an LLM
          agent runtime where models drive programs by writing TypeScript. Every page is grounded in
          the implementation.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/docs"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <BookOpen className="h-4 w-4" strokeWidth={2} />
            Read the docs
          </Link>
          <CardLink
            to="/format"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Project &amp; space format
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </CardLink>
        </div>
      </section>

      {/* Section cards */}
      <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((node) => {
          const meta = CARD_META[node.key]
          const Icon = meta.icon
          return (
            <CardLink
              key={node.key}
              to={node.route!}
              className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-6 transition-all hover:border-brand-1/40 hover:shadow-lg"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-md bg-muted transition-colors group-hover:bg-accent"
                aria-hidden="true"
              >
                <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              </span>
              <h2 className="text-base font-semibold text-card-foreground">{node.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{meta.description}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary">
                Explore
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </span>
            </CardLink>
          )
        })}
      </section>
    </div>
  )
}
