import { createFileRoute, Link } from '@tanstack/react-router'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

export const Route = createFileRoute('/')({
  component: Landing,
})

const services = [
  {
    name: 'lmthing.studio',
    tagline: 'Build AI agents visually',
    description:
      'Design, test, and iterate on agents with a visual workspace. Drag knowledge, wire flows, and ship — no boilerplate.',
    color: 'var(--brand-1)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128m0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
      </svg>
    ),
  },
  {
    name: 'lmthing.chat',
    tagline: 'Your personal THING',
    description:
      'A private AI companion that knows your context. Chat naturally, switch models on the fly, and keep conversations synced across devices.',
    color: 'var(--brand-2)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0m0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0m0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0m0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25" />
      </svg>
    ),
  },
  {
    name: 'lmthing.computer',
    tagline: 'Full runtime, zero setup',
    description:
      'Spin up a cloud machine with terminal access in seconds. Your THING agent runs here — with real compute, real files, real power.',
    color: 'var(--brand-3)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25" />
      </svg>
    ),
  },
  {
    name: 'lmthing.space',
    tagline: 'Deploy and publish agents',
    description:
      'Package your spaces into deployable containers or publish agents for API access. One-click deploy to the edge.',
    color: 'var(--brand-4)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0" />
      </svg>
    ),
  },
  {
    name: 'lmthing.blog',
    tagline: 'AI news, personalized',
    description:
      'Your daily AI briefing, curated by agents that learn what you care about. Never miss what matters.',
    color: 'var(--brand-5)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5" />
      </svg>
    ),
  },
  {
    name: 'lmthing.store',
    tagline: 'Agent marketplace',
    description:
      'Discover, install, and monetize agents. Browse community creations or publish your own to reach thousands of users.',
    color: 'var(--spectrum-8)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75" />
      </svg>
    ),
  },
  {
    name: 'lmthing.social',
    tagline: 'Public hive mind',
    description:
      'Share agents and conversations publicly. Explore what the community is building and remix ideas in real time.',
    color: 'var(--spectrum-18)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0m6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0m-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0" />
      </svg>
    ),
  },
  {
    name: 'lmthing.team',
    tagline: 'Private agent rooms',
    description:
      'Collaborate with your team in shared agent workspaces. Private rooms, shared knowledge, real-time co-editing.',
    color: 'var(--spectrum-28)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25" />
      </svg>
    ),
  },
  {
    name: 'lmthing.casa',
    tagline: 'AI-powered smart home',
    description:
      'Connect your THING to Home Assistant and control your home with natural language. Automations that actually understand you.',
    color: 'var(--spectrum-38)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
        <path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
]

const features = [
  {
    title: 'OpenAI-compatible API',
    description: 'Drop-in replacement. Point your existing code at lmthing and it just works.',
  },
  {
    title: 'Multi-model routing',
    description: 'Access GPT, Claude, Gemini, Mistral, and more through a single endpoint.',
  },
  {
    title: 'Built-in budgets',
    description: 'Per-user token budgets and rate limits. Never get a surprise bill.',
  },
  {
    title: 'Spaces architecture',
    description: 'Agents + Flows + Knowledge. A composable system for building anything.',
  },
  {
    title: 'GitHub-native sync',
    description: 'Your workspace is a git repo. Version control, branching, collaboration — built in.',
  },
  {
    title: 'Edge deployment',
    description: 'Deploy agents to containers worldwide. Low latency, high availability.',
  },
]

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:py-40">
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
            The open platform for building, running, and sharing AI agents.
            <br className="hidden sm:block" />
            One ecosystem. Every model. Your rules.
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
        </div>
      </section>

      {/* Services Grid */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16 animate-fade-in-up-delay-3">
            <h2 className="text-3xl sm:text-4xl tracking-tight">
              One <CozyThingText text="thing" className="text-3xl sm:text-4xl" /> for everything
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Nine interconnected services that cover the entire AI agent lifecycle — from creation to deployment to community.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((service, i) => (
              <div
                key={service.name}
                className="group relative rounded-xl border border-border bg-card p-6 hover:border-transparent hover:shadow-lg transition-all duration-300"
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

      {/* Features */}
      <section className="px-6 py-20 sm:py-28 border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl tracking-tight">Built different</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Not another wrapper. A complete platform with real infrastructure behind it.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="space-y-2">
                <h3 className="font-semibold text-base">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl tracking-tight">Start free, scale when ready</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            $1/week free token budget. No credit card required. Upgrade anytime from $5/month.
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
