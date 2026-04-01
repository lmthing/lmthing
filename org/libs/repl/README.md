# @lmthing/repl

A **neural harness** for LLMs — a self-correcting, multi-threading cognitive runtime with git-backed state persistence. 

Think of it as an **executive function layer** that gives LLMs working memory, motor primitives, error-driven learning, and the ability to spawn parallel thought processes — all while maintaining a git-trail of every mental state.

## Why It Matters

Traditional LLM interaction is stateless: prompt → response → forget. The REPL gives LLMs **persistent cognition**:

- **Working memory** — Scope variables form a persistent mental state across turns
- **Motor primitives** — Control functions for action, sensing, and coordination
- **Self-correction** — Error signals abort execution, trigger recovery, reinforce learning
- **Parallel processing** — Fork multiple thought pathways, wait, compare results
- **Episodic memory** — Checkpoints saved to git worktrees, branch on uncertainty
- **Context engineering** — Active memory management via pin, decay, compress, memo
- **Semantic memory** — Vector search on comment blocks enables retrieval of past reasoning patterns

## Architecture: The Neural Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Session                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Stream     │  │   Sandbox    │  │   Working    │  │   Parallel   │ │
│  │ Controller   │←→│   (vm)       │←→│   Memory     │←→│   Pathways   │ │
│  │  (sensory    │  │  (execute    │  │  (scope)     │  │  (fork/      │ │
│  │   input)     │  │   TS → JS)   │  │              │  │   spawn)     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│           ↓                  ↓                  ↓                  ↓     │
│    Token stream      Thought execution   Current mental    Multiple     │
│    chunked in        in isolated sandbox  state (scope)    sub-minds    │
│           └──────────────┬──────────────────┴──────────────────┘       │
│                          ↓                                           │
│                   Result/Error signal                                │
│                   (reinforcement/learning)                           │
│                          ↓                                           │
│                   Git commit checkpoint                              │
│                   (episodic memory)                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### The Cognitive Loop

```ts
import { Session } from '@lmthing/repl'
import { streamText } from 'ai'

const session = new Session({
  config: {
    functionTimeout: 30_000,
    askTimeout: 300_000,
    maxContextTokens: 100_000,
  },
  fileWorkingDir: '/path/to/git/repo',  // git-backed state
})

// Sensory input: user message
await session.handleUserMessage('Analyze this dataset and find patterns')

// Thought generation: LLM streams tokens
const result = await streamText({
  model: yourModel,
  messages: session.getMessages(),
})

// Execution feed: tokens → thoughts → actions
for await (const chunk of result.textStream) {
  await session.feedToken(chunk)  // executes as thoughts complete
}

// Consolidation: finalize, checkpoint if needed
const status = await session.finalize()

// Continue with updated mental state
const nextTurn = session.getMessages()  // includes all learning
```

## How the Neural Harness Works

### Thought-Execution-Feedback Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│  LLM generates thought stream (tokens)                              │
│       ↓                                                            │
│  Accumulate, detect complete thoughts (statements)                  │
│       ↓                                                            │
│  Transpile to executable (TS → JS)                                  │
│       ↓                                                            │
│  Execute in isolated sandbox (neural compartment)                   │
│       ↓                                                            │
│  ┌─────────────────┐                                               │
│  │ Success?        │                                               │
│  └────────┬────────┘                                               │
│       ↓           ↓                                                │
│    Yes            No                                               │
│       ↓           ↓                                                │
│  Results     Error signal                                          │
│  captured    (negative reinforcement)                              │
│       ↓           ↓                                                │
│  └───────────┬───┘                                                │
│              ↓                                                     │
│      Sensory feedback (injected as user message)                   │
│              ↓                                                     │
│      LLM receives, updates mental model, continues                 │
└─────────────────────────────────────────────────────────────────────┘
```

### The `stop()` Primitive: Sensory Feedback + Context Report

`stop()` is **proprioception** — how the mind senses its own outputs AND maintains context awareness:

```ts
// LLM thinks:
const patterns = analyzeDataset(data)
const clusters = groupPatterns(patterns)
stop(patterns, clusters)
```

The mind receives a **structured context report**, not just the values:

```
← patterns [Array<Pattern>] clusters [Array<Cluster>]

┌─────────────────────────────────────────────────────────────┐
│  Current Scope (12 variables)                               │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  data         |  Array   |  [1000 items]             │ │
│  │  patterns     |  Array   |  [15 items]               │ │
│  │  clusters     |  object  |  { north: [...], ... }    │ │
│  │  baseline     |  number  |  50000                    │ │ ← pinned
│  └───────────────────────────────────────────────────────┘ │
│                                                              │
│  Active Tasks: 2 running, 1 ready                           │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  [ ] aggregate-sales    (running, 45% complete)      │ │
│  │  [ ] identify-trends     (ready to start)            │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                              │
│  Child Agents: 1 waiting for response                      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  analysisAgent (awaiting question response)           │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**This keeps the agent context-conscious:**

- **What values were produced** — the stopped variables
- **What's in scope** — current working memory
- **What tasks are active** — parallel work in progress
- **What agents are waiting** — child processes needing attention
- **What's pinned** — important context to preserve

The agent never loses track of its mental state — every `stop()` provides a complete self-report.

### Context Consciousness Across Turns

Because every `stop()` includes a full context report, the agent maintains **continuous self-awareness**:

```
Turn 3: stop(metrics)
┌─────────────────────────────────────────┐
│ Scope: data, byRegion, metrics          │
│ Tasks: none                             │
│ Agents: none                            │
└─────────────────────────────────────────┘

         ↓ agent reads report, knows what exists

Turn 4: // Agent knows 'metrics' exists from previous report
const baseline = metrics.reduce(...)
```

This creates **contextual continuity** — the agent doesn't need to remember what it declared; each `stop()` reminds it of its entire mental state.

**Without context consciousness**, an agent might:
- Forget a variable exists and re-declare it
- Lose track of running background tasks
- Not know child agents are waiting for responses

**With context consciousness**, every turn begins with full self-awareness.

### Chain-of-Thought: Comments as Transparent Reasoning

Agents use comments extensively to **externalize their thinking process** — making reasoning transparent and debuggable:

```ts
// First, load the raw data to understand its structure
const rawData = await readFile('./data/sales.json')
stop(rawData)  // inspect before processing

// Observed: array of 1000+ objects with region, date, amount fields
// Need to aggregate by region to identify underperformers

// Group by region for analysis
const byRegion = rawData.reduce((acc, sale) => {
  acc[sale.region] = acc[sale.region] || []
  acc[sale.region].push(sale)
  return acc
}, {})

// Calculate metrics per region
const metrics = Object.entries(byRegion).map(([region, sales]) => {
  const total = sales.reduce((sum, s) => sum + s.amount, 0)
  const avg = total / sales.length
  return { region, total, avg, count: sales.length }
})

stop(metrics)  // verify calculations before proceeding

// Now identify underperformers (below 80% of average)
const baseline = metrics.reduce((sum, m) => sum + m.total, 0) / metrics.length
const underperformers = metrics.filter(m => m.total < baseline * 0.8)

stop(underperformers, baseline)  // final result
```

**Why comments matter:**

1. **Reasoning transparency** — See the agent's thought process, not just outputs
2. **Debugging** — Understand *why* an agent made a decision
3. **Learning** — New agents can read the thought patterns of experienced ones
4. **Collaboration** — Human reviewers can follow the logic
5. **Self-correction** — Agent can re-read its own comments to maintain context

The REPL preserves these comments in the code window (with decay) — so the agent's reasoning chain remains accessible as context for subsequent turns.

### Semantic Memory: Vector Search on Past Reasoning

Every comment block is **vectorized** and indexed — the agent can semantically search its entire history of thoughts:

```ts
// Agent encounters a similar situation later:
const results = await vectorSearch("how to aggregate sales by region")
// Returns past comment blocks + surrounding code:

/*
  Match 1 (similarity: 0.94) — Turn 3, 2 days ago
  ────────────────────────────────────────────────────────
  // Need to group by region - data has 1000+ items,
  // aggregate first then calculate metrics
  const byRegion = rawData.reduce((acc, sale) => {
    acc[sale.region] = acc[sale.region] || []
    acc[sale.region].push(sale)
    return acc
  }, {})

  Match 2 (similarity: 0.87) — Turn 12, 1 week ago  
  ────────────────────────────────────────────────────────
  // Grouping large dataset by category for analysis
  const grouped = data.reduce((groups, item) => {
    groups[item.category] = groups[item.category] || []
    groups[item.category].push(item)
    return groups
  }, {})
*/
```

**This enables:**

1. **Pattern recognition** — Agent finds similar problems it solved before
2. **Learning from past** — Reuses proven approaches instead of guessing
3. **Self-improvement** — Better solutions emerge over time as patterns repeat
4. **Contextual awareness** — Knows what it did in similar situations
5. **Debugging** — When something fails, search for "what worked last time"

The vector index persists across sessions — creating **long-term semantic memory** that the agent can query to retrieve relevant past reasoning and code patterns.

### Using Semantic Memory: Example

```ts
// Agent encounters a new problem:
const problem = "need to deduplicate array of objects by id"

// Search for similar past reasoning
const past = await vectorSearch(problem)

// Found relevant pattern from 3 days ago
if (past.matches.length > 0) {
  const { code, comments } = past.matches[0]
  
  // Agent sees the past solution:
  // "Use Map with id as key for O(n) deduplication"
  
  // Apply the learned pattern:
  const deduped = (arr: any[]) => {
    const map = new Map(arr.map(item => [item.id, item]))
    return Array.from(map.values())
  }
  
  stop(deduped, 'Applied pattern from past reasoning')
}
```

This creates **meta-learning**: the agent doesn't just remember data — it remembers *how it solved problems* and can retrieve those solution patterns when facing similar challenges.

### Managing Working Memory

Agents use comments extensively to **externalize their thinking process** — making reasoning transparent and debuggable:

```ts
// First, load the raw data to understand its structure
const rawData = await readFile('./data/sales.json')
stop(rawData)  // inspect before processing

// Observed: array of 1000+ objects with region, date, amount fields
// Need to aggregate by region to identify underperformers

// Group by region for analysis
const byRegion = rawData.reduce((acc, sale) => {
  acc[sale.region] = acc[sale.region] || []
  acc[sale.region].push(sale)
  return acc
}, {})

// Calculate metrics per region
const metrics = Object.entries(byRegion).map(([region, sales]) => {
  const total = sales.reduce((sum, s) => sum + s.amount, 0)
  const avg = total / sales.length
  return { region, total, avg, count: sales.length }
})

stop(metrics)  // verify calculations before proceeding

// Now identify underperformers (below 80% of average)
const baseline = metrics.reduce((sum, m) => sum + m.total, 0) / metrics.length
const underperformers = metrics.filter(m => m.total < baseline * 0.8)

stop(underperformers, baseline)  // final result
```

**Why comments matter:**

1. **Reasoning transparency** — See the agent's thought process, not just outputs
2. **Debugging** — Understand *why* an agent made a decision
3. **Learning** — New agents can read the thought patterns of experienced ones
4. **Collaboration** — Human reviewers can follow the logic
5. **Self-correction** — Agent can re-read its own comments to maintain context

The REPL preserves these comments in the code window (with decay) — so the agent's reasoning chain remains accessible as context for subsequent turns.

This creates **self-awareness**: the mind can observe its own outputs and adjust.

### Error Signals: Negative Reinforcement

Errors trigger immediate interruption — like pain signals in biological cognition:

```ts
// LLM thinks:
const result = JSON.parse(invalidData)

// Cognition aborts with error signal:
// ← error [SyntaxError] Line 12: Unexpected token in JSON

// LLM receives error, self-corrects:
try {
  const result = JSON.parse(data)
  stop(result)
} catch {
  const fixed = data.replace(/'/g, '"')
  const result = JSON.parse(fixed)
  stop(result)
}
```

The error-then-correction pattern **reinforces learning**.

## Working Memory: The Scope

The REPL's scope is the agent's **working memory** — its current mental state:

```
┌─────────────────────────────────────────────────────────────┐
│  {{SCOPE}} — Current Mental State                           │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  userInput     |  string   |  "analyze trends"        │ │
│  │  rawData       |  array    |  [5000 items]            │ │
│  │  cleanedData   |  array    │  [342 items]             │ │
│  │  patterns      |  object   |  { trend: "up", ... }    │ │
│  │  confidence    |  number   |  0.87                    │ │  ← pinned (LTP)
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

This mental state:
- Persists across turns (short-term memory)
- Is included in every system prompt (self-awareness)
- Can be actively managed (memory strategies)

### Memory Strategies

The agent can actively manage its working memory:

#### Long-Term Potentiation (Pin)

```ts
const keyFindings = extractFindings(analysis)
pin(keyFindings)  // strengthen synapse, never decay
const userContext = await loadUserContext()
pin(userContext)
```

Pinned variables resist decay — always available in conscious awareness.

#### Memory Consolidation (Memo)

```ts
const summary = await compress(largeAnalysis)  // LLM compresses
memo('analysis-2024-04-01', summary)  // store for later retrieval
```

#### Decay (Forgetting Curve)

Old data automatically decays to manage cognitive load:
- **Full recall** (recent): all data available
- **Keys only** (middle): just what existed
- **Summary** (old): that it happened

This mirrors the **forgetting curve** — recent memories are vivid, old ones compress.

#### Explicit Cleanup

```ts
const tempBuffer = largeBuffer()
// ... use ...
tempBuffer = null  // explicit forgetting
```

## Parallel Processing: Multiple Thought Pathways

The mind can spawn multiple parallel processes and wait for convergence:

### Forking: Parallel Hypothesis Testing

```ts
// Spawn multiple thought processes to work in parallel
const branchA = await fork('Test hypothesis A', { 
  context: dataA,
  maxTurns: 3 
})
const branchB = await fork('Test hypothesis B', { 
  context: dataB,
  maxTurns: 3 
})
const branchC = await fork('Test hypothesis C', { 
  context: dataC,
  maxTurns: 3 
})

// Wait for all to complete
const results = await parallel([branchA, branchB, branchC])

// Compare and decide
stop(results)
```

Each fork is an **isolated mental simulation** — spawns in a sandbox snapshot, runs independently, returns structured output.

### Speculative Execution: Divergent Thinking

```ts
// Try multiple approaches simultaneously
const candidates = await speculate([
  { label: 'approach-alpha', fn: () => solveMethodA(data) },
  { label: 'approach-beta', fn: () => solveMethodB(data) },
  { label: 'approach-gamma', fn: () => solveMethodC(data) }
], 5000)

// All complete, pick best
const best = candidates.results
  .filter(r => r.ok)
  .sort((a, b) => b.score - a.score)[0]

stop(best)
```

This is **divergent thinking** — generate multiple solutions, evaluate, select.

## Episodic Memory: Git-Backed Checkpoints

Every mental state can be saved to git — creating a permanent, branchable memory trail:

### Checkpoint: Save Mental State

```ts
const beforeRisk = checkpoint()  // snapshot entire working memory

try {
  const result = await riskyOperation(data)
  stop(result)
} catch {
  rollback(beforeRisk)  // restore previous mental state
  stop(failed, 'Reverted to checkpoint')
}
```

### Git Integration: Memory is Never Lost

When using `fileWorkingDir`, file writes create git commits:

```ts
// LLM writes:
const report = generateReport(data)
await writeFile('./output/report.md', report)

// Behind the scenes: git commit with diff
// Git preserves every version, allows branching/merging
```

This creates:
- **Permanent memory trail** — every state is recoverable
- **Branchable exploration** — try paths in parallel, merge results
- **Collaboration** — multiple agents can share mental states via git

## Motor Primitives: Control Functions

These globals give LLMs **agency** — the ability to act, sense, and coordinate:

### Core Primitives

| Primitive | Function |
|-----------|----------|
| `stop(...values)` | Sensory feedback — observe outputs |
| `display(jsx)` | Non-blocking output — show without pausing |
| `ask(jsx)` | Blocking input — request user input |
| `async(fn)` | Fire-and-forget — background process |
| `sleep(sec)` | Wait — delay execution |

### Task Coordination

| Primitive | Function |
|-----------|----------|
| `tasklist(plan)` | Declare task graph with dependencies |
| `completeTask(id, output)` | Mark task complete |
| `failTask(id, error)` | Mark task failed |
| `retryTask(id)` | Retry failed task |
| `taskProgress(id, msg, %)` | Update progress |

### Memory Management

| Primitive | Function |
|-----------|----------|
| `pin(var)` | Strengthen synapse — prevent decay |
| `unpin(var)` | Weaken synapse — allow decay |
| `memo(key, value)` | Store compressed note |
| `checkpoint()` | Save mental state snapshot |
| `rollback(snapshot)` | Restore mental state |
| `contextBudget()` | Check cognitive load (tokens) |

### Parallel Processing

| Primitive | Function |
|-----------|----------|
| `fork(task, context)` | Spawn isolated thought process |
| `speculate(branches)` | Parallel hypothesis testing |
| `parallel(promises)` | Wait for multiple processes |

### Meta-Cognition

| Primitive | Function |
|-----------|----------|
| `vectorSearch(query)` | Search past reasoning by semantic similarity |
| `reflect(question)` | Self-reflection — analyze own state |
| `compress(data)` | Compress for memory efficiency |
| `plan(goal)` | Generate plan via LLM |
| `critique(output)` | Evaluate quality |
| `learn(topic, insight)` | Persist to long-term memory |

### Social Cognition

| Primitive | Function |
|-----------|----------|
| `loadClass(name)` | Load new capability (neural module) |
| `askParent(question)` | Request help from parent process |
| `respond(promise, data)` | Provide help to child process |
| `delegate(agent, input)` | Delegate to specialist |
| `broadcast(channel, msg)` | Broadcast to listeners |
| `listen(channel, handler)` | Receive broadcasts |

## Multi-Turn Reasoning: Example

A complete cognitive session showing iterative problem-solving **with chain-of-thought comments**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  User: "Analyze sales data and find underperforming regions"       │
│                                                                     │
│  Turn 1:                                                            │
│    // Load data to understand structure and size                    │
│    const data = await readFile('./sales.json')                     │
│    stop(data)  // inspect before deciding approach                  │
│    → data [Array<1000> items]                                      │
│                                                                     │
│  Turn 2: (LLM sees dataset, decides aggregation strategy)           │
│    // Need to group by region - data has 1000+ items,               │
│    // aggregate first then calculate metrics                        │
│    const byRegion = data.reduce((acc, sale) => {                    │
│      acc[sale.region] = acc[sale.region] || []                     │
│      acc[sale.region].push(sale)                                   │
│      return acc                                                    │
│    }, {})                                                          │
│    stop(byRegion)  // verify grouping worked                       │
│    → byRegion { north: [...], south: [...], ... }                  │
│                                                                     │
│  Turn 3: (LLM calculates per-region metrics)                        │
│    // Calculate total and average per region for comparison         │
│    const metrics = Object.entries(byRegion).map(([region, sales]) =>│
│    //   ({ region, total: sum(sales), avg: average(sales) }))      │
│    )                                                                │
│    // Alternative: could also include count, min, max if needed     │
│    stop(metrics)  // check calculations before filtering            │
│    → metrics [Array<RegionMetric>]                                 │
│                                                                     │
│  Turn 4: (LLM identifies underperformers)                           │
│    // Underperformer = below 80% of regional average               │
│    const baseline = metrics.reduce((sum, m) => sum + m.total, 0)    │
│                    / metrics.length                                 │
│    const threshold = baseline * 0.8  // 80% threshold              │
│    const underperformers = metrics.filter(m => m.total < threshold) │
│    stop(underperformers, threshold)  // show threshold for context  │
│    → underperformers [Array<RegionMetric>]                         │
│                                                                     │
│  Turn 5: (LLM saves report, creates checkpoint)                     │
│    // Generate readable report with findings                        │
│    const report = formatReport(underperformers, threshold)          │
│    await writeFile('./output/underperformers.md', report)           │
│    checkpoint()  // save mental state to git for recovery           │
│    stop(report)  // confirm save complete                           │
│    → report [string] ✓ File written, checkpoint saved              │
└─────────────────────────────────────────────────────────────────────┘
```

Each turn:
1. **Thinks** (writes code + comments explaining reasoning)
2. **Executes** (in sandbox)
3. **Senses** (via `stop()`)
4. **Updates mental model** (scope)
5. **Continues** (next turn, with full context of previous reasoning)

## Installation

```bash
pnpm add @lmthing/repl
```

## Catalog Functions: Built-in Capabilities

Pre-built neural modules for common tasks:

| Module | Capabilities |
|--------|-------------|
| `fs` | Read/write files — interact with environment |
| `fetch` | HTTP requests — gather external data |
| `shell` | Execute commands — system interaction |
| `path` | Path manipulation — filesystem navigation |
| `env` | Environment variables — configuration |
| `date` | Time/date ops — temporal reasoning |
| `crypto` | Hashing, UUID — security, identity |
| `json` | Parse/stringify — data serialization |
| `csv` | CSV handling — spreadsheet data |
| `image` | Image processing — visual data |
| `db` | SQLite queries — structured storage |

```ts
import { loadCatalog, formatCatalogForPrompt } from '@lmthing/repl'

const modules = await loadCatalog(['fs', 'fetch', 'shell'])
const promptBlock = formatCatalogForPrompt(modules)
```

## Knowledge System: Semantic Memory

Structured, hierarchical knowledge that agents can load on demand:

```
space/
└── knowledge/
    └── {domain}/              // semantic category
        ├── config.json         // metadata (label, icon, color)
        └── {field}/            // knowledge field
            ├── config.json     // field type, default value
            └── {option}.md     // YAML + markdown content
```

Load by selector:

```ts
const knowledge = await loadKnowledgeFiles({
  'domain-space-structure': {
    'component-type': { 'agents': true }
  }
}, tree)
```

This is **semantic memory** — persistent, structured knowledge the agent can access as needed.

## The Space Pattern

A **Space** is a complete cognitive environment:

```
{space}/
├── agents/           // Specialists (modules of expertise)
├── flows/            // Procedures (stepwise reasoning patterns)
├── functions/        // Skills (reusable capabilities)
├── components/       // UI constructs (interaction patterns)
└── knowledge/        // Semantic memory (domain knowledge)
```

## Hook System: Neural Interception

Intercept thoughts before/after execution — implement neural monitoring:

```ts
const registry = new HookRegistry()

registry.register({
  id: 'monitor-destructuring',
  label: 'Track destructuring patterns',
  pattern: { type: 'VariableDeclaration', kind: 'const' },
  phase: 'after',
  handler: (match, ctx) => {
    // Track what variables LLM is creating
    return { type: 'side_effect', fn: () => logVariables(match) }
  }
})
```

## Session Events: Neural Signals

40+ event types for monitoring cognition:

```ts
session.on('event', (event) => {
  switch (event.type) {
    case 'code':      // Thought generated
    case 'read':      // Sensory feedback (stop)
    case 'error':     // Error signal
    case 'scope':     // Working memory state
    case 'checkpoint': // Episodic memory saved
    case 'spawn_start': // Parallel process spawned
    // ... 30+ more
  }
})
```

## Resource Limits: Cognitive Budget

Prevent runaway cognition:

```ts
const sandbox = new Sandbox({
  resourceLimits: {
    maxTotalExecutionMs: 300_000,  // max thinking time
    maxLines: 5000,                 // max thoughts
    maxVariables: 500,              // max working memory items
  }
})
```

## Usage from @lmthing/core

The core framework uses the REPL as its cognitive engine:

```ts
import { Session, AgentLoop } from 'lmthing'

const session = new Session({
  fileWorkingDir: '/workspace',  // git-backed
  knowledgeLoader: (selector) => loadKnowledgeFiles(selector, tree),
  onSpawn: (config) => executeSpawn(config, context)
})

const loop = new AgentLoop({
  session,
  model: provider,
  instruct: agentPrompt,
})

await loop.run(userMessage)
```

## License

MIT
