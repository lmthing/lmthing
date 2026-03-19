# Tickle your LLM by making it only speak code

**TL;DR:** We built an agent system where the LLM writes and executes TypeScript line-by-line in a live REPL instead of calling tools. Zero tool definitions. Zero JSON schemas for function calling. The agent just... writes code. And it runs. In real time. As tokens stream in.

---

## The Problem with Tool Calling

Every agentic framework today works the same way: you define tools with JSON schemas, the LLM picks which tool to call, the framework executes it, and the result goes back into context. Rinse and repeat.

This sounds clean on paper. In practice:

- **Tool definitions bloat the system prompt.** 20 tools with schemas? That's thousands of tokens before the agent even starts thinking.
- **The LLM describes intent, it doesn't do the work.** It says "I want to call search_products with query='shoes'" — then a framework layer interprets and dispatches. Why the middleman?
- **No conditional logic without multiple round trips.** Want to check a value and branch? That's tool call → result → another tool call. Each round trip eats latency and tokens.
- **Composability is an afterthought.** Chaining tool results together requires the LLM to juggle state across turns, narrating what it's doing in prose between calls.

We asked: what if the agent could just... write code?

---

## Enter REPL: Streaming TypeScript Execution

**@lmthing/repl** is a streaming TypeScript REPL agent system. Here's the paradigm shift:

**The agent outputs only TypeScript. No prose. No markdown. Every character it emits is fed line-by-line into a live sandbox that executes as tokens stream in.**

```
┌─────────────┐     token stream     ┌──────────────────┐     execute     ┌──────────────┐
│  LLM Agent  │ ──────────────────▶  │  Stream Parser &  │ ─────────────▶ │  TypeScript   │
│  (provider) │ ◀──────────────────  │  Line Accumulator │ ◀──────────── │  REPL Sandbox │
│             │   context injection  │                   │    results     │              │
└─────────────┘                      └──────────────────┘                └──────────────┘
                                            │                                   │
                                            ▼                                   │
                                     ┌──────────────┐                          │
                                     │  React       │ ◀────────────────────────┘
                                     │  Render      │    display() / ask() calls
                                     │  Surface     │
                                     └──────────────┘
```

This is not "generate a script, then run it." Each statement executes **the instant it's complete**. The agent sees errors immediately, reads runtime values, and branches accordingly — all within a single streaming turn.

---

## The 12 Globals: All You Need

Instead of tool definitions, the agent gets 12 injected global primitives. That's it. The entire control surface:

### `await stop(...values)` — The Read Primitive
The agent's only way to inspect runtime state. Pauses execution, serializes values, injects them as a user message. The agent resumes with knowledge of those values.

```ts
const results = await searchProducts("shoes")
await stop(results.length)
// Agent now sees: ← stop { "results.length": 42 }
// Agent can branch: if there are 42 results, filter further
```

### `display(jsx)` — Render React Components
Non-blocking. Show anything to the user — charts, cards, tables, progress indicators. The agent composes real React JSX inline.

```ts
display(<ProductGrid items={results} />)
display(<Chart data={analytics} type="bar" />)
```

### `await ask(jsx)` — Interactive Forms
Renders a form, blocks until submit, but **doesn't reveal values**. The agent must explicitly `stop()` to read what the user entered. This forces deliberate acknowledgment of user input.

```ts
const prefs = await ask(
  <form>
    <Select name="cuisine" label="Preferred cuisine" options={["Italian", "Mexican", "Thai"]} />
    <Slider name="budget" label="Budget" min={10} max={200} />
  </form>
)
await stop(prefs)
// Now the agent knows what the user picked and can act on it
```

### `tasklist()` + `completeTask()` — Structured Task Plans
Declare milestones before doing work. Track progress with DAG dependencies, conditions, and optional tasks. More on this below — it's a game changer.

### `async()` — Background Concurrency
Fire-and-forget tasks that run alongside the main execution. Results arrive at the next `stop()` call.

### `loadKnowledge()` — On-Demand Context
Pull structured markdown from the knowledge base. Synchronous. Load only what you need, when you need it.

### Plus: `completeTaskAsync()`, `taskProgress()`, `failTask()`, `retryTask()`, `sleep()`

Every primitive is designed to be composable. No schema overhead. No dispatch layer. Just code.

---

## Spaces: Self-Contained Agent Workspaces

This is where REPL gets truly powerful. A **Space** is a self-contained workspace with three pillars: **Agents**, **Flows**, and **Knowledge** — all defined with just markdown files and JSON configs.

```
my-space/
├── package.json
├── agents/
│   └── agent-food-advisor/
│       ├── config.json        # functions, components, knowledge bindings
│       ├── instruct.md        # personality, slash actions, behavior rules
│       └── values.json        # runtime state
├── flows/
│   └── flow_plan_meals/
│       ├── index.md           # overview
│       ├── 1.Gather Preferences.md
│       ├── 2.Search Recipes.md
│       ├── 3.Build Plan.md
│       └── 4.Present Results.md
├── knowledge/
│   ├── cuisine/
│   │   ├── config.json        # { label: "Cuisine Type", icon: "🍽️" }
│   │   └── italian.md         # rich context with YAML frontmatter
│   └── dietary/
│       ├── config.json
│       └── vegan.md
├── functions/
│   └── searchRecipes.ts       # custom TypeScript functions
└── components/
    └── view/
        └── MealPlanCard.tsx    # custom React components
```

**No backend code. No API routes. No deployment config.** You define an agent's entire capability surface with markdown and JSON.

---

## Agents: Specialists Defined in Markdown

Each agent has an `instruct.md` with YAML frontmatter that defines everything:

```yaml
---
title: Food Advisor
model: anthropic:claude-sonnet-4-20250514
actions:
  - id: mealplan
    label: Make a meal plan
    description: Create a personalized weekly meal plan
    flow: flow_plan_meals
  - id: nutrition
    label: Nutrition check
    description: Analyze nutritional content
    flow: flow_check_nutrition
---

You are a culinary expert. You specialize in personalized meal planning
based on dietary restrictions, budget, and cuisine preferences.

Always load relevant knowledge before giving advice.
Always ask for preferences before making recommendations.
```

And a `config.json` that wires up capabilities:

```json
{
  "functions": ["catalog/fetch", "catalog/csv", "searchRecipes", "nutritionLookup"],
  "components": ["MealPlanCard", "NutritionChart", "catalog/component/form/*"],
  "knowledge": {
    "cuisine": "italian",
    "dietary": ["vegan", "gluten-free"],
    "restrictions": false
  }
}
```

The knowledge config controls what the agent sees:
- **String value** → pre-loads that option into context automatically
- **Array** → pre-loads multiple options
- **`false`** → hides that field entirely
- **`true`** → available on demand via `loadKnowledge()`

---

## Flows: Predefined Task Plans from Markdown Files

This is one of the most innovative parts. **Flows are sequential workflows defined as numbered markdown files that automatically become executable task lists.**

When a user types `/mealplan`, here's what happens:

1. The system matches the slash action to `flow_plan_meals`
2. It reads the numbered step files (`1.Gather Preferences.md`, `2.Search Recipes.md`, etc.)
3. Each step's frontmatter and `<output>` blocks are parsed into a task definition
4. The system **generates and injects** a `tasklist()` call into the REPL before the agent's turn
5. The agent sees the tasklist already declared and works through each step

A step file looks like this:

```markdown
---
description: Ask the user about dietary preferences and cuisine type
---

Ask the user for their dietary restrictions, preferred cuisines,
number of people to cook for, and weekly budget. Use the knowledge
base to inform your questions.

<output target="preferences">
{
  "dietary": { "type": "array" },
  "cuisines": { "type": "array" },
  "people": { "type": "number" },
  "budget": { "type": "number" }
}
</output>
```

The system turns this into:

```ts
tasklist("flow_plan_meals", "Create a personalized weekly meal plan", [
  { id: "gather-preferences", instructions: "Ask the user about dietary preferences...", outputSchema: { dietary: { type: "array" }, ... } },
  { id: "search-recipes", instructions: "...", outputSchema: { ... }, dependsOn: ["gather-preferences"] },
  { id: "build-plan", instructions: "...", outputSchema: { ... }, dependsOn: ["search-recipes"] },
  { id: "present-results", instructions: "...", outputSchema: { ... }, dependsOn: ["build-plan"] }
])
```

**You define workflows in markdown. The system enforces them as executable task plans with DAG dependencies.** If the agent's stream ends before all tasks are complete, the system automatically injects a reminder and resumes generation.

---

## Knowledge: A Declarative Context Engine

The knowledge system is a hierarchical, structured context layer that agents pull from at runtime:

```
knowledge/
├── cuisine/                    # Domain
│   ├── config.json             # { label: "Cuisine Type", icon: "🍽️", color: "#FF5733" }
│   ├── type/                   # Field (select, multiSelect, text, number)
│   │   ├── config.json         # { type: "select", variableName: "cuisineType" }
│   │   ├── italian.md          # Option — rich markdown with YAML frontmatter
│   │   ├── mexican.md
│   │   └── thai.md
│   └── technique/
│       ├── grilling.md
│       └── sous-vide.md
```

The agent loads knowledge on demand:

```ts
var docs = loadKnowledge({
  "cuisine": {
    "type": { "italian": true, "thai": true }
  }
})
await stop(docs)
// Agent now has full Italian and Thai cuisine guides in context
```

Knowledge isn't static prompt injection — it's **lazy-loaded, scoped, and automatically decayed**. Recent loads get full content. Older loads compress to keys only. Ancient loads are removed. This prevents context bloat while keeping the agent informed.

---

## The Function Catalog: 11 Built-In Modules

Agents can tap into a catalog of pre-built capabilities without any tool definitions:

| Module | Capabilities |
|--------|-------------|
| `fs` | Read, write, list, glob, stat |
| `fetch` | HTTP GET/POST/PUT/DELETE with headers, JSON/text |
| `shell` | Shell command execution, pipes |
| `csv` | Parse, stringify, transform with headers |
| `json` | Parse, query with JSONPath, schema validation |
| `db` | SQLite in-process, Postgres/MySQL connections |
| `crypto` | Hashing, encoding, UUID generation |
| `date` | Parse, format, arithmetic |
| `path` | Join, resolve, relative, parse |
| `image` | Resize, crop, convert (via sharp) |
| `env` | Environment variable access (allowlisted) |

These are injected as globals. The agent just calls them:

```ts
const data = await httpGet("https://api.example.com/products")
const parsed = await csvParse(data.body)
await dbExecute("INSERT INTO products VALUES (?)", parsed)
```

No tool definitions. No schemas. Just functions.

---

## Custom Functions and Classes

Spaces can define custom TypeScript functions and classes in a `functions/` directory:

```ts
// functions/searchRecipes.ts
export async function searchRecipes(cuisine: string, dietary: string[]): Promise<Recipe[]> {
  // your implementation
}

// functions/analytics.ts
export class RecipeAnalytics {
  async topRated(cuisine: string): Promise<Recipe[]> { ... }
  async nutritionBreakdown(recipeId: string): Promise<NutritionData> { ... }
}
```

The agent config declares which functions to load. Classes are automatically instantiated and their methods become callable. The agent uses them like any other function:

```ts
const recipes = await searchRecipes("italian", ["vegan"])
const analytics = new RecipeAnalytics()
const top = await analytics.topRated("italian")
```

---

## Custom React Components

Spaces can ship custom display and form components:

```tsx
// components/view/MealPlanCard.tsx
export function MealPlanCard({ meals, budget }: Props) {
  return (
    <div className="meal-plan">
      {meals.map(meal => <MealRow key={meal.id} {...meal} />)}
      <BudgetSummary total={budget} />
    </div>
  )
}
```

The agent renders them directly:

```ts
display(<MealPlanCard meals={weeklyPlan} budget={userBudget} />)
```

Form components use a static `form = true` property to identify themselves for `ask()` calls. The agent composes both built-in and custom components freely.

---

## Context Management: How REPL Stays in the Window

One of the hardest problems with long agent sessions is context bloat. REPL solves this with aggressive, intelligent compression:

**`{{SCOPE}}` — The Source of Truth.** A live variable table injected into the system prompt on every turn. Never compressed. Always current. The agent checks scope before re-fetching anything.

**Code Window Compression.** A sliding window (default 200 lines). Older code is summarized:
```ts
// [lines 1-47 executed] declared: x, y, results, filtered
const final = process(filtered)  // ← still visible
```

**Stop Payload Decay.** Values from `stop()` calls decay over turns:
- Recent (0-2 turns): full detail
- Mid-range (3-5 turns): keys only
- Old (6+ turns): removed entirely

**Knowledge Decay.** Same tiered system for loaded knowledge. Prevents domain context from bloating indefinitely.

The result: agents can run long, complex sessions without hitting context limits.

---

## Developer Hooks: AST-Level Code Interception

For developers who need guardrails, REPL provides an AST-based hook system with 5 actions:

- **`continue`** — pass through (default)
- **`side_effect`** — run code before/after execution
- **`transform`** — rewrite the agent's code before it runs
- **`interrupt`** — halt execution and inject a message
- **`skip`** — silently skip execution

Hooks fire between parse and execute, giving you full control over what the agent can do. Rate-limit API calls, validate data access, log everything, or transform code patterns — all without modifying the agent itself.

---

## Why This Matters

Traditional agentic frameworks treat LLMs like function dispatchers — describe what you want, and the framework figures out how to do it. REPL treats LLMs like programmers — write the code, and the runtime executes it.

The differences are fundamental:

| | Tool Calling | REPL |
|---|---|---|
| **Agent output** | JSON tool calls + prose | TypeScript code |
| **Execution** | After generation ends | Line-by-line as tokens stream |
| **Conditional logic** | Multiple round trips | Inline branching |
| **Composability** | Manual state threading | Variables in scope |
| **UI** | Framework-rendered | Agent-composed React JSX |
| **Error recovery** | Retry the whole call | Fix the specific line |
| **Schema overhead** | Tool definitions in prompt | Zero |
| **Task planning** | External orchestration | `tasklist()` with DAG deps |
| **Context loading** | All-or-nothing | On-demand `loadKnowledge()` |

**The agent doesn't describe intent. It does the work.**

---

## The Full Picture

When you put it all together — Spaces with markdown-defined agents, flows that become executable task plans, hierarchical knowledge that loads on demand, custom functions and React components, a streaming REPL with 12 control primitives, intelligent context compression, and AST-level hooks — you get an agent system that is:

1. **Radically simpler** — no tool schemas, no dispatch layer, no orchestration framework
2. **More capable** — inline branching, real-time execution, composable UI
3. **Fully declarative** — define agents with markdown and JSON configs, not code
4. **Context-efficient** — aggressive decay keeps long sessions within bounds
5. **Developer-friendly** — hooks, custom functions, custom components, CLI + web UI

This is `@lmthing/repl`. We think it's the future of how agents should work.

---

*Part of the [lmthing](https://github.com/lmthing/lmthing) open-source project. Built on Vercel AI SDK v6, React 19, and TypeScript.*

**What do you think? Would love to hear your thoughts, critiques, and ideas.**
