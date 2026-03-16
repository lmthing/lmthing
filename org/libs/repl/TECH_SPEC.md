# Tech Spec — @lmthing/repl

Technical blueprint for implementing the streaming TypeScript REPL agent.

---

## File Structure

```
org/libs/repl/
├── package.json
├── tsconfig.json
├── CLAUDE.md
├── TECH_SPEC.md
├── docs/                                # Specifications (already exist)
│   ├── agent-system-prompt/
│   ├── host-runtime-contract/
│   └── ux-specification/
└── src/
    ├── index.ts                         # Public API barrel
    │
    ├── cli/                             # CLI Backend (headless — no terminal UI)
    │   ├── bin.ts                       # CLI entry — `lmthing-repl` binary
    │   ├── args.ts                      # Argument parsing (file path, --instruct, --port)
    │   ├── loader.ts                    # Load user's TS file, classify exports as functions or components
    │   └── server.ts                    # WebSocket server — serves web UI + RPC endpoint
    │
    ├── web/                             # Web App (browser entry point)
    │   ├── index.html                   # Standalone HTML shell
    │   ├── main.tsx                     # React 19 + react-dom entry
    │   ├── App.tsx                      # Root app — session view, chat input, async sidebar
    │   ├── rpc-client.ts               # Cap'n Web client — connects to CLI backend
    │   └── vite.config.ts              # Vite config for standalone web build
    │
    ├── rpc/                             # Cap'n Web RPC layer (CLI ↔ Browser)
    │   ├── interface.ts                 # RPC interface definition (shared between client & server)
    │   ├── server.ts                    # RpcTarget implementation — exposes session to browser
    │   └── client.ts                    # Client helper — typed session proxy
    │
    ├── catalog/                         # Function Catalog (built-in agent capabilities)
    │   ├── index.ts                     # Catalog registry — discover, load, merge catalogs
    │   ├── types.ts                     # CatalogFunction interface, metadata schema
    │   ├── fs.ts                        # File system operations (read, write, list, glob, stat)
    │   ├── fetch.ts                     # HTTP fetch (GET/POST/PUT/DELETE, headers, JSON/text)
    │   ├── shell.ts                     # Shell command execution (spawn, exec, pipe)
    │   ├── json.ts                      # JSON manipulation (parse, query with JSONPath, transform)
    │   ├── csv.ts                       # CSV read/write/transform
    │   ├── crypto.ts                    # Hashing, random bytes, UUID generation
    │   ├── date.ts                      # Date parsing, formatting, arithmetic
    │   ├── path.ts                      # Path manipulation (join, resolve, relative, parse)
    │   ├── env.ts                       # Environment variable access (allowlisted)
    │   ├── image.ts                     # Image operations (resize, crop, convert — via sharp)
    │   └── db.ts                        # Database queries (SQLite in-process, Postgres/MySQL via connection string)
    │
    ├── stream/                          # Subsystem 1: Stream Controller
    │   ├── line-accumulator.ts          # Token → complete statement buffering
    │   ├── bracket-tracker.ts           # Bracket depth & string context tracking
    │   ├── stream-controller.ts         # LLM connection, pause/resume, context injection
    │   └── serializer.ts               # Value serialization with truncation limits
    │
    ├── parser/                          # Subsystem 2: Line Parser
    │   ├── statement-detector.ts        # Statement completeness heuristic
    │   ├── global-detector.ts           # Detect stop/display/ask/async calls
    │   └── ast-utils.ts                # TypeScript AST helpers, argument name recovery
    │
    ├── sandbox/                         # Subsystem 3: REPL Sandbox
    │   ├── sandbox.ts                   # vm.Context setup, scope persistence
    │   ├── transpiler.ts               # TypeScript → JavaScript transpilation
    │   ├── executor.ts                  # Line-by-line execution, error capture
    │   ├── globals.ts                   # stop, display, ask, async implementations
    │   └── async-manager.ts            # Background task registry, AbortController
    │
    ├── context/                         # Subsystem 4: Workspace & Context Management
    │   ├── scope-generator.ts           # {{SCOPE}} table generation from sandbox state
    │   ├── system-prompt.ts             # System prompt builder with slot replacement
    │   ├── code-window.ts               # Sliding window compression (200 lines default)
    │   ├── stop-decay.ts               # Stop payload decay tiers (full → keys → count → removed)
    │   └── message-builder.ts          # Wire format message construction
    │
    ├── hooks/                           # Developer Hooks
    │   ├── hook-registry.ts             # Hook registration and management
    │   ├── pattern-matcher.ts           # AST pattern matching with captures
    │   └── hook-executor.ts            # Hook action dispatch (continue/side_effect/transform/interrupt/skip)
    │
    ├── session/                         # Session Lifecycle
    │   ├── session.ts                   # State machine (executing/waiting_for_input/paused/complete/error)
    │   ├── config.ts                    # SessionConfig defaults and validation
    │   └── types.ts                     # Shared type definitions (StopPayload, ErrorPayload, etc.)
    │
    ├── components/                      # React UI Components (browser only)
    │   ├── form/                        # Form input components (ask)
    │   │   ├── TextInput.tsx
    │   │   ├── TextArea.tsx
    │   │   ├── NumberInput.tsx
    │   │   ├── Slider.tsx
    │   │   ├── Checkbox.tsx
    │   │   ├── Select.tsx
    │   │   ├── MultiSelect.tsx
    │   │   ├── DatePicker.tsx
    │   │   ├── FileUpload.tsx
    │   │   ├── Form.tsx
    │   │   └── index.ts                # Barrel export
    │   │
    │   ├── display/                     # Display components (response blocks)
    │   │   ├── CodeBlock.tsx
    │   │   ├── ReadBlock.tsx
    │   │   ├── ErrorBlock.tsx
    │   │   ├── HookBlock.tsx
    │   │   ├── FormCard.tsx
    │   │   ├── AsyncSidebar.tsx
    │   │   └── index.ts                # Barrel export
    │   │
    │   └── shared/                      # Shared utilities
    │       ├── form-extractor.ts        # Extract form data by name attribute
    │       └── block-state.ts          # Collapsible/decay state management
    │
    └── security/                        # Sandbox Security
        ├── function-registry.ts         # Allowlisted function proxy
        └── jsx-sanitizer.ts            # JSX element validation
```

---

## Dependencies

### Core Runtime

| Package | Purpose | Docs |
|---------|---------|------|
| [`typescript`](https://www.npmjs.com/package/typescript) | AST parsing, transpile-only compilation, hook pattern matching | [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) |
| [`ai`](https://www.npmjs.com/package/ai) | Vercel AI SDK v6 — `streamText()`, `generateText()` for LLM streaming | [Vercel AI SDK Docs](https://sdk.vercel.ai/docs) |
| [`zod`](https://www.npmjs.com/package/zod) | Schema validation for tool definitions, form data, session config | [Zod Docs](https://zod.dev) |

### Sandbox

| Package | Purpose | Docs |
|---------|---------|------|
| Node.js `vm` (built-in) | Sandbox execution with persistent `vm.Context` scope | [Node.js vm module](https://nodejs.org/api/vm.html) |
| [`isolated-vm`](https://www.npmjs.com/package/isolated-vm) | Optional — stronger isolation via V8 isolates (if `vm` is insufficient) | [isolated-vm GitHub](https://github.com/nicolo-ribaudo/isolated-vm) |

### Transpilation

| Package | Purpose | Docs |
|---------|---------|------|
| [`typescript`](https://www.npmjs.com/package/typescript) | `ts.transpileModule()` in transpile-only mode (primary) | [transpileModule API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#a-minimal-compiler) |
| [`@swc/core`](https://www.npmjs.com/package/@swc/core) | Optional — faster Rust-based TS transpiler alternative | [SWC Docs](https://swc.rs/docs/getting-started) |

### React — Browser

| Package | Purpose | Docs |
|---------|---------|------|
| [`react`](https://www.npmjs.com/package/react) | Core rendering (v19) | [React Docs](https://react.dev) |
| [`react-dom`](https://www.npmjs.com/package/react-dom) | Browser DOM rendering for `display()` and `ask()` components | [react-dom API](https://react.dev/reference/react-dom) |
| [`@radix-ui/themes`](https://www.npmjs.com/package/@radix-ui/themes) | Accessible form primitives (Select, Checkbox, etc.) | [Radix Themes Docs](https://www.radix-ui.com/themes/docs/overview/getting-started) |

### Syntax Highlighting

| Package | Purpose | Docs |
|---------|---------|------|
| [`shiki`](https://www.npmjs.com/package/shiki) | Syntax highlighting for CodeBlock | [Shiki Docs](https://shiki.style) |

### RPC (CLI ↔ Browser)

| Package | Purpose | Docs |
|---------|---------|------|
| [`capnweb`](https://www.npmjs.com/package/capnweb) | Object-capability RPC over WebSocket — CLI backend ↔ browser UI | [Cap'n Web Blog Post](https://blog.cloudflare.com/capnweb-javascript-rpc-library/) |

### CLI

| Package | Purpose | Docs |
|---------|---------|------|
| [`citty`](https://www.npmjs.com/package/citty) | Lightweight CLI argument parsing | [citty GitHub](https://github.com/unjs/citty) |
| [`tsx`](https://www.npmjs.com/package/tsx) | Run TypeScript files directly (for loading user function files) | [tsx GitHub](https://github.com/privatenumber/tsx) |

### Catalog — Optional Peer Dependencies

| Package | Purpose | Docs |
|---------|---------|------|
| [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3) | In-process SQLite for `catalog/db.ts` | [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) |
| [`sharp`](https://www.npmjs.com/package/sharp) | Image processing for `catalog/image.ts` | [Sharp Docs](https://sharp.pixelplumbing.com) |

### Testing

| Package | Purpose | Docs |
|---------|---------|------|
| [`vitest`](https://www.npmjs.com/package/vitest) | Test runner | [Vitest Docs](https://vitest.dev) |

---

## React Components

All UI rendering happens in the browser. The CLI is a headless backend — it runs the sandbox, manages the LLM connection, and streams session events to the browser via Cap'n Web RPC. Components are standard React (react-dom) with no terminal UI target.

### Form Input Components

These are the components available inside `ask(<form>...</form>)` calls. The agent writes JSX using these, and the host renders the platform-appropriate implementation.

| Component | Props | Extracted Data Type | Implementation |
|-----------|-------|--------------------|----|
| `TextInput` | `name`, `label`, `placeholder?`, `defaultValue?` | `string` | HTML `<input type="text">` / Radix |
| `TextArea` | `name`, `label`, `placeholder?`, `rows?` | `string` | HTML `<textarea>` |
| `NumberInput` | `name`, `label`, `min?`, `max?`, `step?`, `defaultValue?` | `number` | HTML `<input type="number">` / Radix |
| `Slider` | `name`, `label`, `min`, `max`, `step?`, `defaultValue?` | `number` | Radix Slider |
| `Checkbox` | `name`, `label`, `defaultChecked?` | `boolean` | Radix Checkbox |
| `Select` | `name`, `label`, `options: string[]`, `defaultValue?` | `string` | Radix Select |
| `MultiSelect` | `name`, `label`, `options: string[]`, `defaultValue?: string[]` | `string[]` | Radix multi-select checkboxes |
| `DatePicker` | `name`, `label`, `defaultValue?` | `string` (ISO 8601) | HTML `<input type="date">` |
| `FileUpload` | `name`, `label`, `accept?`, `maxSize?` | `{ name, size, type, data }` (base64) | HTML `<input type="file">` with drag-drop |
| `Form` | `children`, `onSubmit?` | `Record<string, any>` | HTML `<form>` with submit button |

**Form data extraction:** On submit, the host walks the form tree, reads each input's `name` attribute, and builds a flat `Record<string, any>` with the extracted values. The agent receives this object when `ask()` resolves.

### Display Components

These render the agent's response blocks in the session view.

| Component | Purpose | Rendering |
|-----------|---------|-----------|
| `CodeBlock` | Collapsible syntax-highlighted TypeScript | Shiki highlighting, expand/collapse toggle, real-time streaming updates |
| `ReadBlock` | Collapsible `stop()` payload display | JSON viewer with decay states (full → keys → count → removed), blue-gray left border |
| `ErrorBlock` | Collapsible error display with recovery status | Red/orange left border, error type + message + source line + recovery status |
| `HookBlock` | Collapsible hook activity display | Purple/amber left border (by action type), pattern + matched line + action + agent response |
| `FormCard` | Elevated card wrapping an `ask()` form | Card with border + shadow, contains form inputs + submit button, submission states |
| `AsyncSidebar` | Background task panel | Sidebar panel (top-right), task cards with spinner/progress/cancel, auto-collapse when empty |

### Example: TextInput

**`src/components/form/TextInput.tsx`**:

```tsx
import { useState } from 'react'

export interface TextInputProps {
  name: string
  label: string
  placeholder?: string
  defaultValue?: string
}

export function TextInput({ name, label, placeholder, defaultValue }: TextInputProps) {
  const [value, setValue] = useState(defaultValue ?? '')

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span>{label}</span>
      <input
        type="text"
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
      />
    </label>
  )
}
```

---

## Build Configuration

### package.json

```jsonc
{
  "name": "@lmthing/repl",
  "version": "0.0.1",
  "type": "module",
  "bin": {
    "lmthing-repl": "./src/cli/bin.ts"
  },
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    },
    "./components/*": "./src/components/*/index.ts"
  },
  "dependencies": {
    "ai": "^4.0.0",
    "capnweb": "^0.1.0",
    "citty": "^0.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "zod": "^3.24.0"
  },
  "optionalDependencies": {
    "better-sqlite3": "^11.0.0",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "@radix-ui/themes": "^3.0.0",
    "@swc/core": "^1.10.0",
    "shiki": "^1.0.0",
    "tsx": "^4.0.0",
    "vitest": "^3.0.0"
  }
}
```

**Key decisions:**

- `capnweb` is a core dependency — used for CLI backend ↔ browser RPC.
- `react` and `react-dom` are core dependencies — all rendering happens in the browser.
- `better-sqlite3` and `sharp` are optional dependencies — only needed if the `db` or `image` catalog modules are used.
- `tsx` is a devDependency used by the CLI to load user function files (handles TypeScript natively).
- `@radix-ui/themes` is a devDependency used for accessible form primitives.
- `@swc/core` is included as a devDependency — can be swapped in for `typescript` transpilation if speed becomes an issue.
- The `bin` field points to `src/cli/bin.ts` — run via `tsx` or compiled for distribution.

### Vite Alias (for monorepo resolution)

In `org/libs/utils/src/vite.mjs`, add:

```js
'@lmthing/repl': path.resolve(dirname, '../org/libs/repl/src'),
```

### tsconfig.json

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationDir": "./dist"
  },
  "include": ["src"]
}
```

---

## CLI Backend

The CLI is a headless backend — no terminal UI. It starts a WebSocket server, serves the React web app, and opens the browser automatically. All agent execution (sandbox, LLM streaming, function calls) runs in the CLI process. The browser is the only UI.

### Usage

```bash
# Functions and components defined in a single file
lmthing-repl restaurant-tools.ts

# Custom port
lmthing-repl restaurant-tools.ts --port 4000

# With special instructions appended to the system prompt
lmthing-repl restaurant-tools.ts --instruct "You are a data analyst. Always visualize results."

# With built-in catalog functions
lmthing-repl restaurant-tools.ts --catalog fs,fetch,shell

# All catalogs
lmthing-repl restaurant-tools.ts --catalog all

# Catalog only (no user file)
lmthing-repl --catalog fs,fetch,json

# Multiple instruction flags (concatenated in order)
lmthing-repl restaurant-tools.ts --instruct "Be concise." --instruct "Prefer TypeScript."
```

Running any of these commands starts the backend, serves the web UI, and opens the browser at `http://localhost:3100` (or the specified port).

### User File — Functions & Components

The user provides a `.ts` / `.tsx` file that exports functions and React components. The CLI loads this file, uses the TypeScript compiler API to analyze each export's type, and automatically classifies them:

- **Functions** — Any export whose type is a function signature (`(...) => ...`). Injected as callable globals in the sandbox.
- **Components** — Any export whose return type is `React.ReactElement`, `JSX.Element`, or `React.ReactNode`, or whose type is `React.FC<...>` / `React.ComponentType<...>`. Injected as available JSX components the agent can use in `display()` and `ask()` calls.

Non-exported symbols are ignored. Non-function, non-component exports (constants, classes, types) are ignored.

**Example: `restaurant-tools.tsx`**

```tsx
import React from 'react'

// ──────────────────────────────────────────────
// Functions — become callable globals in sandbox
// ──────────────────────────────────────────────

/** Search for restaurants by cuisine and location */
export async function searchRestaurants(cuisine: string, zipcode: string, limit = 10) {
  const res = await fetch(`https://api.example.com/restaurants?cuisine=${cuisine}&near=${zipcode}&limit=${limit}`)
  return res.json()
}

/** Get detailed info for a specific restaurant */
export async function getRestaurant(id: string) {
  const res = await fetch(`https://api.example.com/restaurants/${id}`)
  return res.json()
}

/** Book a table at a restaurant */
export async function bookTable(restaurantId: string, date: string, partySize: number) {
  const res = await fetch(`https://api.example.com/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId, date, partySize })
  })
  return res.json()
}

// ──────────────────────────────────────────────
// Components — available in display() and ask()
// ──────────────────────────────────────────────

interface Restaurant {
  id: string
  name: string
  cuisine: string
  rating: number
  priceRange: string
  address: string
  imageUrl?: string
}

/** Renders a list of restaurant cards */
export function RestaurantList({ items }: { items: Restaurant[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(r => (
        <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{r.name}</div>
          <div style={{ color: '#64748b' }}>{r.cuisine} · {r.priceRange} · ⭐ {r.rating}</div>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>{r.address}</div>
        </div>
      ))}
    </div>
  )
}

/** Renders a detailed restaurant card with booking button */
export function RestaurantCard({ restaurant, showBooking }: { restaurant: Restaurant, showBooking?: boolean }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, maxWidth: 480 }}>
      {restaurant.imageUrl && <img src={restaurant.imageUrl} style={{ width: '100%', borderRadius: 8 }} />}
      <h2>{restaurant.name}</h2>
      <p>{restaurant.cuisine} · {restaurant.priceRange} · ⭐ {restaurant.rating}</p>
      <p style={{ color: '#64748b' }}>{restaurant.address}</p>
      {showBooking && <button style={{ marginTop: 12, padding: '8px 16px' }}>Book a Table</button>}
    </div>
  )
}
```

### Export Classification via TypeScript Compiler API

The loader (`src/cli/loader.ts`) uses `ts.createProgram()` to type-check the user's file and classify each export:

```ts
import ts from 'typescript'

interface ClassifiedExport {
  name: string
  kind: 'function' | 'component'
  signature: string     // TS signature string for the system prompt
  description: string   // JSDoc comment, if any
  propsType?: string    // For components: serialized props interface
}

function classifyExport(symbol: ts.Symbol, checker: ts.TypeChecker): ClassifiedExport['kind'] | null {
  const type = checker.getTypeOfSymbol(symbol)

  // Check call signatures
  const callSignatures = type.getCallSignatures()
  if (callSignatures.length === 0) return null  // not callable → skip

  const returnType = checker.getReturnTypeOfSignature(callSignatures[0])
  const returnTypeStr = checker.typeToString(returnType)

  // Component: returns JSX.Element, React.ReactElement, React.ReactNode, or ReactElement
  if (
    returnTypeStr === 'JSX.Element' ||
    returnTypeStr === 'Element' ||
    returnTypeStr.includes('ReactElement') ||
    returnTypeStr.includes('ReactNode')
  ) {
    return 'component'
  }

  // Component: FC<P> or ComponentType<P> (type alias, not call signature return)
  const typeStr = checker.typeToString(type)
  if (typeStr.includes('FC<') || typeStr.includes('ComponentType<')) {
    return 'component'
  }

  // Everything else callable is a function
  return 'function'
}
```

### What the CLI does with classified exports

1. **Load** — Dynamically imports the file via `tsx` (handles TS/TSX natively, resolves `node_modules`).
2. **Type-check & classify** — Creates a `ts.Program` for the file, iterates exports, classifies each as `function` or `component` using the return type analysis above.
3. **Inject functions into sandbox** — Each function export becomes a callable global in the `vm.Context`. The agent can call `searchRestaurants("Italian", "94107")` directly.
4. **Register components** — Each component export is registered in the component registry. The agent can use them in `display(<RestaurantList items={restaurants} />)` calls. Components are rendered in the browser — the sandbox serializes the JSX tree and sends it via RPC.
5. **Generate system prompt blocks** — Builds both `{{FUNCTIONS}}` and `{{COMPONENTS}}` for the system prompt:

```
Available functions:
  searchRestaurants(cuisine: string, zipcode: string, limit?: number): Promise<any>
    — Search for restaurants by cuisine and location
  getRestaurant(id: string): Promise<any>
    — Get detailed info for a specific restaurant
  bookTable(restaurantId: string, date: string, partySize: number): Promise<any>
    — Book a table at a restaurant

Available components:
  <RestaurantList items: Restaurant[] />
    — Renders a list of restaurant cards
  <RestaurantCard restaurant: Restaurant, showBooking?: boolean />
    — Renders a detailed restaurant card with booking button
```

### Special Instructions (`--instruct`)

Appended verbatim to the end of the system prompt, after the standard REPL rules. Multiple `--instruct` flags are concatenated with newlines. This is where users customize the agent's persona, domain, constraints, or output preferences without modifying the core prompt.

### CLI Argument Schema

```ts
interface CLIArgs {
  /** Path to user's .ts/.tsx file exporting functions and/or components (positional, optional if --catalog is set) */
  file?: string

  /** Special instructions appended to system prompt */
  instruct?: string[]

  /** Built-in catalog modules to enable (comma-separated or "all") */
  catalog?: string

  /** Port for WebSocket server + web UI (default: 3100) */
  port?: number

  /** LLM model identifier (e.g., "anthropic/claude-sonnet-4-20250514") */
  model?: string

  /** Session timeout in seconds (default: 600) */
  timeout?: number
}
```

---

## Web App

The browser frontend for chatting with the agent. Served by the CLI backend on the same port as the WebSocket RPC endpoint. Connects to the backend via Cap'n Web, renders session state with React components, and sends user input back via RPC.

The web app can also be embedded into Studio or other lmthing products via the `@lmthing/repl` component exports.

### Web App Structure

```
src/web/
├── index.html        # Shell with <div id="root">
├── main.tsx          # createRoot + <App />
├── App.tsx           # Layout: session blocks + chat input + async sidebar
├── rpc-client.ts     # Cap'n Web WebSocket session to CLI backend
└── vite.config.ts    # Build config for standalone bundle
```

**`App.tsx`** consumes session state streamed from the CLI backend via RPC. It renders display components (`CodeBlock`, `ReadBlock`, `ErrorBlock`, `HookBlock`, `FormCard`, `AsyncSidebar`) and form components (`TextInput`, `Select`, etc.).

User input (chat messages, form submissions, task cancellations) flows back to the CLI via RPC method calls.

---

## Cap'n Web RPC — CLI ↔ Browser

The CLI backend and browser frontend communicate via [Cap'n Web](https://blog.cloudflare.com/capnweb-javascript-rpc-library/), an object-capability RPC library that runs over WebSocket. It provides bidirectional calling, promise pipelining, and capability-based security — all under 10 kB.

### Why Cap'n Web

- **Bidirectional** — The CLI pushes session state updates and rendered components to the browser. The browser pushes user input and form submissions back. Both directions are first-class.
- **Promise pipelining** — Chained calls (e.g., submit form → get next display) resolve in a single round trip.
- **Capability-based** — The CLI exposes a session object with specific methods. The browser can only call what's been granted — no arbitrary RPC surface.
- **Lightweight** — Zero dependencies, <10 kB gzipped. No protobuf compilation step.

### RPC Interface

**`src/rpc/interface.ts`** — the shared contract:

```ts
/** Exposed by CLI (backend) → consumed by browser (frontend) */
export interface ReplSession {
  /** Send a user message to the agent */
  sendMessage(text: string): Promise<void>

  /** Submit form data for a pending ask() */
  submitForm(formId: string, data: Record<string, any>): Promise<void>

  /** Cancel a pending ask() */
  cancelAsk(formId: string): Promise<void>

  /** Cancel a background async task */
  cancelTask(taskId: string, message?: string): Promise<void>

  /** Pause the agent */
  pause(): Promise<void>

  /** Resume the agent */
  resume(): Promise<void>

  /** User intervention — inject a message while agent is running */
  intervene(text: string): Promise<void>

  /** Get current session snapshot (for reconnection) */
  getSnapshot(): Promise<SessionSnapshot>

  /** Subscribe to session events — returns a stream of events */
  subscribe(): AsyncIterable<SessionEvent>
}

/** Events streamed from CLI → browser */
export type SessionEvent =
  | { type: 'code'; lines: string; blockId: string }
  | { type: 'code_complete'; blockId: string; lineCount: number }
  | { type: 'read'; payload: Record<string, any>; blockId: string }
  | { type: 'error'; error: { type: string; message: string; line: number; source: string }; blockId: string }
  | { type: 'hook'; hookId: string; action: string; detail: string; blockId: string }
  | { type: 'display'; componentId: string; jsx: SerializedJSX }
  | { type: 'ask_start'; formId: string; jsx: SerializedJSX }
  | { type: 'ask_end'; formId: string }
  | { type: 'async_start'; taskId: string; label: string }
  | { type: 'async_progress'; taskId: string; elapsed: number }
  | { type: 'async_complete'; taskId: string; elapsed: number }
  | { type: 'async_failed'; taskId: string; error: string }
  | { type: 'async_cancelled'; taskId: string }
  | { type: 'status'; status: 'executing' | 'waiting_for_input' | 'paused' | 'complete' | 'error' }
  | { type: 'scope'; entries: ScopeEntry[] }

/** Serialized JSX for transport (components resolved on browser side) */
export interface SerializedJSX {
  component: string
  props: Record<string, any>
  children?: SerializedJSX[]
}

export interface SessionSnapshot {
  status: string
  blocks: Array<{ type: string; id: string; data: any }>
  scope: ScopeEntry[]
  asyncTasks: Array<{ id: string; label: string; status: string; elapsed: number }>
  activeFormId: string | null
}

export interface ScopeEntry {
  name: string
  type: string
  value: string
}
```

### Server (CLI side)

**`src/rpc/server.ts`** — the CLI exposes the session:

```ts
import { RpcTarget, handleWebSocket } from 'capnweb'
import type { ReplSession, SessionEvent, SessionSnapshot } from './interface'

export class ReplSessionServer extends RpcTarget implements ReplSession {
  private session: Session  // internal session state machine
  private listeners = new Set<(event: SessionEvent) => void>()

  constructor(session: Session) {
    super()
    this.session = session
    // Forward session events to all subscribers
    session.on('event', (event: SessionEvent) => {
      for (const listener of this.listeners) listener(event)
    })
  }

  async sendMessage(text: string) {
    await this.session.handleUserMessage(text)
  }

  async submitForm(formId: string, data: Record<string, any>) {
    await this.session.resolveAsk(formId, data)
  }

  async cancelAsk(formId: string) {
    await this.session.cancelAsk(formId)
  }

  async cancelTask(taskId: string, message = '') {
    await this.session.cancelAsyncTask(taskId, message)
  }

  async pause() {
    this.session.pause()
  }

  async resume() {
    this.session.resume()
  }

  async intervene(text: string) {
    await this.session.handleIntervention(text)
  }

  async getSnapshot(): Promise<SessionSnapshot> {
    return this.session.snapshot()
  }

  async *subscribe(): AsyncIterable<SessionEvent> {
    const queue: SessionEvent[] = []
    let resolve: (() => void) | null = null

    const listener = (event: SessionEvent) => {
      queue.push(event)
      resolve?.()
    }
    this.listeners.add(listener)

    try {
      while (true) {
        if (queue.length === 0) {
          await new Promise<void>(r => { resolve = r })
        }
        while (queue.length > 0) yield queue.shift()!
      }
    } finally {
      this.listeners.delete(listener)
    }
  }
}
```

### Client (Browser side)

**`src/rpc/client.ts`**:

```ts
import { newWebSocketRpcSession } from 'capnweb'
import type { ReplSession } from './interface'

export function connectToRepl(url = 'ws://localhost:3100'): ReplSession {
  return newWebSocketRpcSession<ReplSession>(url)
}
```

**`src/web/rpc-client.ts`** — React integration:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { connectToRepl } from '../rpc/client'
import type { ReplSession, SessionEvent, SessionSnapshot } from '../rpc/interface'

export function useReplSession(url?: string) {
  const [session, setSession] = useState<ReplSession | null>(null)
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null)

  useEffect(() => {
    const rpc = connectToRepl(url)
    setSession(rpc)

    // Load initial snapshot
    rpc.getSnapshot().then(setSnapshot)

    // Subscribe to live events
    ;(async () => {
      for await (const event of rpc.subscribe()) {
        setSnapshot(prev => applyEvent(prev, event))
      }
    })()

    return () => { /* disconnect */ }
  }, [url])

  return { session, snapshot }
}

function applyEvent(prev: SessionSnapshot | null, event: SessionEvent): SessionSnapshot {
  // Reducer — apply event to snapshot (block additions, status changes, scope updates, etc.)
  // ...
}
```

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                          Browser                             │
│                                                              │
│  ┌──────────┐  SessionEvent  ┌────────────────────────────┐  │
│  │  App.tsx  │ ◀──────────── │  Cap'n Web RPC Client      │  │
│  │  (React)  │ ──────────▶   │  (WebSocket)               │  │
│  └──────────┘  sendMessage   └─────────────┬──────────────┘  │
│       │        submitForm                  │                 │
│       ▼        intervene                   │                 │
│  ┌──────────────────┐                      │                 │
│  │  *.web.tsx        │                      │                 │
│  │  components       │                      │                 │
│  └──────────────────┘                      │                 │
└────────────────────────────────────────────┼─────────────────┘
                                             │ WebSocket
┌────────────────────────────────────────────┼─────────────────┐
│                        CLI Backend         │                 │
│                                            │                 │
│  ┌─────────────────────────────────────────┴──────────────┐  │
│  │  Cap'n Web RPC Server (ReplSessionServer)              │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │  Session (state machine)                               │  │
│  │  ┌────────────┐ ┌──────────┐ ┌────────────┐           │  │
│  │  │  Stream     │ │  REPL    │ │  Context   │           │  │
│  │  │  Controller │ │  Sandbox │ │  Manager   │           │  │
│  │  └────────────┘ └──────────┘ └────────────┘           │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │  Sandbox Globals                                       │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐  │  │
│  │  │ User funcs   │ │ Catalog      │ │ 4 globals     │  │  │
│  │  │ (tools.ts)   │ │ (fs, fetch…) │ │ (stop,display │  │  │
│  │  │              │ │              │ │  ask, async)  │  │  │
│  │  └──────────────┘ └──────────────┘ └───────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│                    LLM (streamText)                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Function Catalog

Built-in function modules that can be enabled via `--catalog`. Each module exports functions that become globals in the sandbox, alongside user-defined functions from the `.ts` file.

### Catalog Registration

```ts
// src/catalog/types.ts
export interface CatalogFunction {
  /** Function name — becomes a global in the sandbox */
  name: string
  /** Human-readable description — injected into system prompt */
  description: string
  /** TypeScript signature string for the system prompt */
  signature: string
  /** The actual implementation */
  fn: (...args: any[]) => any
}

export interface CatalogModule {
  /** Module name (e.g., "fs", "fetch") */
  id: string
  /** One-line description */
  description: string
  /** Functions provided by this module */
  functions: CatalogFunction[]
}
```

### Available Modules

#### `fs` — File System Operations

| Function | Signature | Description |
|----------|-----------|-------------|
| `readFile` | `(path: string, encoding?: string) => Promise<string>` | Read file contents |
| `writeFile` | `(path: string, content: string) => Promise<void>` | Write content to file |
| `appendFile` | `(path: string, content: string) => Promise<void>` | Append to file |
| `listDir` | `(path: string, options?: { recursive?: boolean }) => Promise<string[]>` | List directory entries |
| `glob` | `(pattern: string, cwd?: string) => Promise<string[]>` | Glob pattern match |
| `stat` | `(path: string) => Promise<{ size: number, modified: string, isDir: boolean }>` | File metadata |
| `exists` | `(path: string) => Promise<boolean>` | Check if path exists |
| `mkdir` | `(path: string) => Promise<void>` | Create directory (recursive) |
| `remove` | `(path: string) => Promise<void>` | Delete file or directory |
| `copy` | `(src: string, dest: string) => Promise<void>` | Copy file or directory |
| `move` | `(src: string, dest: string) => Promise<void>` | Move/rename file or directory |

All paths are resolved relative to the working directory. Paths that escape the working directory are blocked (see Security).

#### `fetch` — HTTP Requests

| Function | Signature | Description |
|----------|-----------|-------------|
| `httpGet` | `(url: string, headers?: Record<string, string>) => Promise<any>` | GET request, auto-parses JSON |
| `httpPost` | `(url: string, body: any, headers?: Record<string, string>) => Promise<any>` | POST with JSON body |
| `httpPut` | `(url: string, body: any, headers?: Record<string, string>) => Promise<any>` | PUT with JSON body |
| `httpDelete` | `(url: string, headers?: Record<string, string>) => Promise<any>` | DELETE request |
| `httpRequest` | `(options: RequestOptions) => Promise<{ status: number, headers: Record<string, string>, body: any }>` | Full control — method, headers, body, timeout |
| `fetchPage` | `(url: string) => Promise<{ title: string, text: string, links: string[] }>` | Fetch webpage, extract readable text (HTML → text) |
| `downloadFile` | `(url: string, dest: string) => Promise<{ size: number }>` | Download to local file |

#### `shell` — Command Execution

| Function | Signature | Description |
|----------|-----------|-------------|
| `exec` | `(command: string, options?: { cwd?: string, timeout?: number }) => Promise<{ stdout: string, stderr: string, exitCode: number }>` | Run shell command |
| `execLive` | `(command: string, options?: { cwd?: string, timeout?: number }) => AsyncIterable<{ stream: 'stdout' \| 'stderr', data: string }>` | Streaming command output |
| `which` | `(binary: string) => Promise<string \| null>` | Find binary in PATH |

#### `json` — JSON Manipulation

| Function | Signature | Description |
|----------|-----------|-------------|
| `jsonParse` | `(text: string) => any` | Parse JSON (with better error messages) |
| `jsonQuery` | `(data: any, path: string) => any` | JSONPath query (e.g., `$.store.books[*].author`) |
| `jsonTransform` | `(data: any, fn: (item: any) => any) => any` | Map over arrays/objects |
| `jsonMerge` | `(...objects: any[]) => any` | Deep merge objects |
| `jsonDiff` | `(a: any, b: any) => Diff[]` | Structural diff |

#### `csv` — CSV Processing

| Function | Signature | Description |
|----------|-----------|-------------|
| `csvParse` | `(text: string, options?: { header?: boolean, delimiter?: string }) => any[]` | Parse CSV to array of objects/arrays |
| `csvStringify` | `(data: any[], options?: { header?: boolean, delimiter?: string }) => string` | Convert to CSV string |
| `csvReadFile` | `(path: string, options?: CsvOptions) => Promise<any[]>` | Read and parse CSV file |
| `csvWriteFile` | `(path: string, data: any[], options?: CsvOptions) => Promise<void>` | Write data as CSV file |

#### `crypto` — Cryptographic Utilities

| Function | Signature | Description |
|----------|-----------|-------------|
| `hash` | `(data: string, algorithm?: 'sha256' \| 'sha512' \| 'md5') => string` | Hash string |
| `randomBytes` | `(length: number) => string` | Random hex string |
| `uuid` | `() => string` | Generate UUID v4 |
| `base64Encode` | `(data: string) => string` | Encode to base64 |
| `base64Decode` | `(data: string) => string` | Decode from base64 |

#### `date` — Date/Time

| Function | Signature | Description |
|----------|-----------|-------------|
| `now` | `() => string` | Current ISO 8601 timestamp |
| `parseDate` | `(input: string) => Date` | Parse date string (flexible formats) |
| `formatDate` | `(date: Date \| string, format: string) => string` | Format date (e.g., `"YYYY-MM-DD"`) |
| `addDays` | `(date: Date \| string, days: number) => Date` | Date arithmetic |
| `diffDays` | `(a: Date \| string, b: Date \| string) => number` | Days between dates |

#### `path` — Path Manipulation

| Function | Signature | Description |
|----------|-----------|-------------|
| `joinPath` | `(...segments: string[]) => string` | Join path segments |
| `resolvePath` | `(...segments: string[]) => string` | Resolve to absolute |
| `relativePath` | `(from: string, to: string) => string` | Relative path between two paths |
| `parsePath` | `(p: string) => { dir: string, base: string, ext: string, name: string }` | Parse path components |
| `dirname` | `(p: string) => string` | Directory name |
| `basename` | `(p: string, ext?: string) => string` | Base name |
| `extname` | `(p: string) => string` | Extension |

#### `env` — Environment Variables

| Function | Signature | Description |
|----------|-----------|-------------|
| `getEnv` | `(key: string) => string \| undefined` | Read environment variable (allowlisted only) |
| `listEnv` | `() => string[]` | List available (allowlisted) variable names |

The allowlist is configured at session init. By default, common variables like `HOME`, `USER`, `PATH`, `LANG`, `TERM`, and any `LMTHING_*` / user-specified prefixes are exposed. Secrets (`*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`) are blocked unless explicitly allowlisted.

#### `image` — Image Operations (requires `sharp`)

| Function | Signature | Description |
|----------|-----------|-------------|
| `imageResize` | `(src: string, dest: string, options: { width?: number, height?: number }) => Promise<void>` | Resize image |
| `imageCrop` | `(src: string, dest: string, region: { left, top, width, height }) => Promise<void>` | Crop image |
| `imageConvert` | `(src: string, dest: string, format: 'png' \| 'jpg' \| 'webp') => Promise<void>` | Convert format |
| `imageInfo` | `(src: string) => Promise<{ width, height, format, size }>` | Image metadata |

#### `db` — Database (requires `better-sqlite3` or connection string)

| Function | Signature | Description |
|----------|-----------|-------------|
| `dbQuery` | `(sql: string, params?: any[]) => Promise<any[]>` | Run SELECT query, return rows |
| `dbExecute` | `(sql: string, params?: any[]) => Promise<{ changes: number }>` | Run INSERT/UPDATE/DELETE |
| `dbSchema` | `() => Promise<{ tables: Array<{ name, columns }> }>` | Get database schema |

Defaults to an in-process SQLite file (`./repl.db`). If `--db` connection string is provided, connects to Postgres or MySQL instead.

### Catalog in the System Prompt

Enabled catalog functions are merged with user-defined exports in the `{{FUNCTIONS}}` and `{{COMPONENTS}}` blocks. Functions from the catalog and the user file appear together, grouped by source:

```
Available functions:

  # Built-in: fs
  readFile(path: string, encoding?: string): Promise<string>
    — Read file contents
  writeFile(path: string, content: string): Promise<void>
    — Write content to file
  listDir(path: string, options?: { recursive?: boolean }): Promise<string[]>
    — List directory entries

  # Built-in: fetch
  httpGet(url: string, headers?: Record<string, string>): Promise<any>
    — GET request, auto-parses JSON
  fetchPage(url: string): Promise<{ title: string, text: string, links: string[] }>
    — Fetch webpage, extract readable text

  # User-defined (restaurant-tools.tsx)
  searchRestaurants(cuisine: string, zipcode: string, limit?: number): Promise<any>
    — Search for restaurants by cuisine and location
  bookTable(restaurantId: string, date: string, partySize: number): Promise<any>
    — Book a table at a restaurant

Available components:

  # User-defined (restaurant-tools.tsx)
  <RestaurantList items: Restaurant[] />
    — Renders a list of restaurant cards
  <RestaurantCard restaurant: Restaurant, showBooking?: boolean />
    — Renders a detailed restaurant card with booking button
```

### Security Considerations

- **`fs`** — All paths resolved relative to CWD. Traversal above CWD blocked. Symlinks followed only within CWD.
- **`shell`** — Commands run in a child process with the session's CWD. No shell expansion by default (`execFile` not `exec` internally). Timeout enforced.
- **`fetch`** — No restrictions by default. Can be constrained via `--allow-hosts` flag to limit outbound requests.
- **`env`** — Allowlist-only access. Secret patterns blocked by default.
- **`db`** — SQLite file is session-scoped. Remote DB connections require explicit `--db` flag.
