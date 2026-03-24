# lmthing

A complete platform for building, running, and deploying AI agents. At its center is **THING** — a super agent that creates knowledge fields, spawns custom agents on demand, and orchestrates them to solve complex tasks.

The ecosystem spans a non-profit (lmthing.org), a commercial entity (lmthing.com), and product domains: Studio for building, Chat for conversing, Space for deploying, Blog for personalized AI news, Social for collective intelligence, Team for private collaboration, Store for the agent marketplace, and Casa for smart home control.

## Getting Started

```bash
# Clone and install
git clone git@github.com:lmthing/lmthing.git
cd lmthing
pnpm install

# Run Studio (the main development surface)
cd studio
pnpm dev
```

**Prerequisites:** Node.js >= 20, pnpm >= 9, Deno (for cloud/edge functions), Git

## Repository Structure

The monorepo is organized by TLD — each lmthing.* domain has its own top-level directory.

```
lmthing/
├── org/                    # Non-profit / open-source
│   ├── libs/               # Shared libraries used across all domains
│   │   ├── core/           # lmthing — agentic framework (TypeScript, Vercel AI SDK v6)
│   │   ├── state/          # @lmthing/state — virtual file system (React hooks, Map-based VFS)
│   │   ├── css/            # Shared styles
│   │   └── ui/             # Shared UI components
│   └── docs/               # Documentation
├── cloud/                  # @lmthing/cloud — Supabase Edge Functions (Deno)
├── studio/                 # lmthing.studio — agent builder UI (React 19, Vite 7, TanStack Router)
├── chat/                   # lmthing.chat — personal THING interface
├── blog/                   # lmthing.blog — personalized AI news
├── space/                  # lmthing.space — K8s agent runtime
├── social/                 # lmthing.social — public hive mind
├── team/                   # lmthing.team — private agent rooms
├── store/                  # lmthing.store — agent marketplace
├── casa/                   # lmthing.casa — smart home (Home Assistant)
├── com/                    # lmthing.com — commercial landing page
├── devops/                 # Infrastructure automation (Ansible, Kubespray, ops docs)
├── pnpm-workspace.yaml
└── package.json
```

## Key Packages

| Directory | Package | Stack |
|-----------|---------|-------|
| `org/libs/core/` | lmthing | TypeScript, Vercel AI SDK v6, Zod, vm2 |
| `org/libs/state/` | @lmthing/state | React hooks, Map-based VFS, FSEventBus |
| `org/libs/css/` | — | Shared CSS |
| `org/libs/ui/` | — | Shared React components |
| `cloud/` | @lmthing/cloud | Deno, Supabase Edge Functions, @stripe/ai-sdk |
| `studio/` | @lmthing/studio | React 19, Vite 7, TanStack Router, Tailwind 4, Radix UI |

## Documentation

- [Architecture](./Architecture.md) — full product & domain architecture
- [Tech Architecture](./TechArchitecture.md) — developer onboarding & system overview
- [Cloud Backend](./cloud/README.md) — cloud setup & deployment
- [DevOps](./devops/README.md) — Kubernetes bootstrap and infrastructure docs

## License

See [LICENSE](./LICENSE) for details.
