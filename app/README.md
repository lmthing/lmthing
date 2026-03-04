# Lmthing Studio

A visual interface for building, testing, and deploying AI agents without writing code. Transform your domain expertise into powerful AI agents through an intuitive drag-and-drop interface.

## Features

### 🤖 Agent Builder
Design and configure AI agents with custom personalities, capabilities, and knowledge access. Define system prompts, select LLM providers, and configure tool access through a user-friendly interface.

### 📚 Knowledge Management
Organize your expertise into structured markdown files. Create knowledge domains with folders and documents that agents can access. Supports full-text search and hierarchical organization.

### 🔄 Flow Builder
Create multi-step workflows visually with a node-based editor. Chain actions together, add conditional logic, and define complex agent behaviors without code.

### 🎯 Agent Runtime
Test your agents in real-time conversations. Watch them execute tools, access knowledge, and follow flows. Debug and refine agent behavior interactively.

### ✨ THING Assistant
AI-powered workspace generation. Describe what you need in natural language, and THING automatically creates the complete workspace structure with agents, knowledge bases, and flows.

### 🔗 GitHub Integration
Connect your GitHub account to store workspaces as repositories. Automatic syncing, version control, and collaboration built-in.

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- pnpm 10+ (or npm/yarn)

### Installation

```bash
# From the monorepo root
pnpm install

# Or from the app directory
cd app && pnpm install
```

### Development

```bash
# Start the development server
pnpm dev

# Open http://localhost:5173
```

### Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. (Optional) Configure GitHub OAuth for workspace syncing:
- Create a GitHub OAuth App at https://github.com/settings/developers
- Set the callback URL to `http://localhost:5173`
- Add your Client ID to `.env`:
```env
VITE_GITHUB_CLIENT_ID=your_client_id_here
```

### Building

```bash
# Production build
pnpm build

# Preview production build
pnpm preview

# Build for GitHub Pages
pnpm build:pages
```

## Project Structure

```
app/
├── src/
│   ├── components/        # Reusable UI components
│   │   └── ui/           # shadcn/ui components
│   ├── sections/         # Main application sections
│   │   ├── agent-builder/
│   │   ├── agent-runtime/
│   │   ├── flow-builder/
│   │   ├── knowledge/
│   │   ├── prompt-library/
│   │   ├── tool-library/
│   │   └── workspaces/
│   ├── shell/            # Layout components
│   ├── hooks/            # React hooks
│   ├── lib/              # Utilities and core logic
│   └── types/            # TypeScript definitions
├── e2e/                  # Playwright end-to-end tests
├── mock_data/            # Demo workspaces
└── public/               # Static assets
```

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v7
- **Testing**: Playwright
- **Agent Framework**: lmthing (monorepo sibling)

## Demo Workspaces

The app includes three pre-configured demo workspaces:

- **Education**: Learning and tutoring agents with lesson planning capabilities
- **Plants**: Indoor plant care coaching with care guides and diagnostics
- **Web Development**: React and web component building assistants

Access them from the landing page or navigate directly to `/studio/{workspace-name}/studio`.

## Testing

```bash
# Run end-to-end tests
pnpm test:e2e

# Run tests in UI mode
pnpm test:e2e:ui

# Run specific test file
pnpm exec playwright test e2e/agent.spec.ts
```

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm build:pages` - Build for GitHub Pages deployment
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm test:e2e` - Run Playwright tests

## Configuration Files

- `vite.config.ts` - Main Vite configuration
- `vite.config.pages.ts` - GitHub Pages specific build config
- `tailwind.config.js` - Tailwind CSS configuration
- `components.json` - shadcn/ui component configuration
- `playwright.config.ts` - End-to-end test configuration
- `tsconfig.json` - TypeScript configuration

## Contributing

This is part of the lmthing monorepo. See the [root README](../README.md) for contribution guidelines.

## Documentation

- [Agent Guidance](./agents.md) - For AI agents working with this codebase
- [Product Overview](./product/product-overview.md)
- [Data Shape Specification](./product/data-shape/data-shape.md)
- [Design System](./product/design-system/)

## License

See [LICENSE](./LICENSE) for details.
