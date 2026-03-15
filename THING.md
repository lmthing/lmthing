# THING Agent — Core Features Implementation Plan

THING is lmthing's super agent. Architecture.md describes it as an agent that **spawns background agents**, **receives async reports**, **evaluates agents with metrics**, **generates datasets**, and **triggers SLM fine-tuning**. This document details the five core plugins and two cloud edge functions needed to make THING a reality.

---

## Current State

The core library (`org/libs/core/`) has a solid foundation:

| Plugin | Status | What It Does |
|--------|--------|--------------|
| `defTaskList` | Complete | Flat task management with startTask/completeTask/failTask tools |
| `defTaskGraph` | Complete | DAG task dependencies, cycle detection, spawn/fork/ask node types |
| `defFunction` | Complete | TypeScript execution in vm2 sandbox |
| `defFunctionAgent` | Complete | Spawns child prompts for function execution |
| `defMethod` | Complete | Inline `<run_code>` zero-step execution |
| `defKnowledgeAgent` | Complete | Reads THING spaces, injects knowledge, executes flows via defTaskList |

**The critical gap:** `defAgent` is **synchronous/blocking** — the parent calls `const result = prompt.run(); await result.text` and waits for the child to finish before continuing. THING needs to spawn agents in the background, orchestrate multiple concurrent agents, evaluate their outputs, and generate training data.

---

## Architecture Overview

Five new plugins, two cloud edge functions, all following the existing plugin pattern (`defState` + `defTool` + `defEffect`):

```
Feature 1:  defBackgroundAgent  ← foundation (non-blocking agent spawning)
Feature 2:  defOrchestratedGraph  ← extends taskGraph + backgroundAgent (DAG of agents)
Feature 3:  defEval  ← agent evaluation (LLM-as-judge, human eval, iterative testing)
Feature 4:  defDataset  ← dataset generation (I/O pair collection for fine-tuning)
Feature 5:  defFineTune  ← fine-tuning integration (cloud edge functions + core plugin)
```

Each feature is independently shippable. Feature 1 alone unlocks THING's core capability.

---

## Feature 1: Background Agent Spawning (`defBackgroundAgent`)

### Why

Architecture.md: *"spawn these agents as background processes that run independently and report back asynchronously"*

The current `defAgent` in `StatefulPrompt.ts:543-598` blocks:

```typescript
// Current blocking pattern (StatefulPrompt.ts:575-576)
const result = prompt.run();
const lastResponse = await result.text;  // ← blocks parent until child finishes
```

### New Files

```
org/libs/core/src/plugins/backgroundAgent/
├── backgroundAgent.ts    # Plugin implementation
└── index.ts              # Re-exports
```

### Types

Add to `org/libs/core/src/plugins/types.ts`:

```typescript
// ============================================================
// Background Agent Plugin Types
// ============================================================

export type BackgroundJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BackgroundJob {
  /** Unique job identifier */
  id: string;
  /** Name of the background agent */
  agentName: string;
  /** Current execution status */
  status: BackgroundJobStatus;
  /** Unix timestamp when the job was spawned */
  startedAt: number;
  /** Unix timestamp when the job completed or failed */
  completedAt?: number;
  /** Agent's final text response (set on completion) */
  result?: string;
  /** Error message (set on failure) */
  error?: string;
  /** Latest progress message from the agent */
  progress?: string;
  /** Full log of progress messages */
  progressLog: string[];
}

export interface SpawnBackgroundAgentResult {
  success: boolean;
  jobId: string;
  message: string;
}

export interface CheckJobStatusResult {
  success: boolean;
  job?: BackgroundJob;
  message: string;
}

export interface GetJobResultResult {
  success: boolean;
  jobId: string;
  result?: string;
  error?: string;
  message: string;
}

export interface ListJobsResult {
  success: boolean;
  jobs: BackgroundJob[];
  summary: string;
}
```

### Plugin API

```typescript
export function defBackgroundAgent(
  this: StatefulPrompt,
  name: string,
  description: string,
  inputSchema: z.ZodType<any>,
  execute: (args: any, prompt: StatefulPrompt) => Promise<void>,
  options?: AgentOptions & { maxConcurrent?: number }
): void
```

### What It Registers

| Tool | Input Schema | Purpose |
|------|-------------|---------|
| `spawn_{name}` | The `inputSchema` parameter | Spawns child StatefulPrompt, starts `prompt.run()` without awaiting, returns job ID |
| `checkJobStatus` | `{ jobId: z.string() }` | Read job state by ID |
| `getJobResult` | `{ jobId: z.string() }` | Get result text when completed |
| `listJobs` | (none) | Summary of all background jobs |

### How It Works

1. **State:** `defState('backgroundJobs', [])` tracks `BackgroundJob[]`

2. **Spawning (non-blocking):**
   ```typescript
   // Inside spawn_{name} tool handler:
   const childPrompt = StatefulPrompt.create(model || this.getModel());
   childPrompt.setPlugins(plugins || this._plugins || []);

   if (system) childPrompt.defSystem('agentSystem', system);
   await execute(args, childPrompt);

   const streamResult = childPrompt.run();

   // Fire-and-forget: resolve in background, update job state
   streamResult.text.then(
     (text) => {
       setJobs(prev => prev.map(j =>
         j.id === jobId
           ? { ...j, status: 'completed', result: text, completedAt: Date.now() }
           : j
       ));
     },
     (err) => {
       setJobs(prev => prev.map(j =>
         j.id === jobId
           ? { ...j, status: 'failed', error: err.message, completedAt: Date.now() }
           : j
       ));
     }
   );

   return { success: true, jobId, message: `Spawned ${name} as background job ${jobId}` };
   ```

3. **Progress reporting:** The child prompt gets a `reportProgress` tool injected:
   ```typescript
   childPrompt.defTool('reportProgress', 'Report progress to parent',
     z.object({ message: z.string() }),
     async ({ message }) => {
       setJobs(prev => prev.map(j =>
         j.id === jobId
           ? { ...j, progress: message, progressLog: [...j.progressLog, message] }
           : j
       ));
       return { success: true };
     }
   );
   ```
   This works because `setJobs` is a closure over the parent's `StateManager`, and `StateManager.set()` is synchronous. The parent sees updates on its next step re-execution.

4. **System prompt updates:** `defEffect` on `[backgroundJobs]` injects job statuses:
   ```typescript
   this.defEffect(() => {
     const jobs = getCurrentJobs();
     if (jobs.length === 0) return;

     const running = jobs.filter(j => j.status === 'running');
     const completed = jobs.filter(j => j.status === 'completed');
     const failed = jobs.filter(j => j.status === 'failed');

     let content = '## Background Jobs\n\n';
     if (running.length) content += `### Running (${running.length})\n${formatJobs(running)}\n`;
     if (completed.length) content += `### Completed (${completed.length})\n${formatJobs(completed)}\n`;
     if (failed.length) content += `### Failed (${failed.length})\n${formatJobs(failed)}\n`;
     content += '\nUse checkJobStatus or getJobResult to inspect specific jobs.';

     this.addSystemPart('backgroundJobs', content);
   }, [backgroundJobs]);
   ```

5. **Concurrency control:** `maxConcurrent` option (default 5). When exceeded, jobs are queued with status `'queued'` and dequeued when a running job completes.

### Browser vs Node.js Compatibility

The implementation is identical in both environments because `StatefulPrompt.run()` returns an async `StreamTextResult`. Multiple spawned agents interleave at I/O boundaries (LLM API calls). No worker threads needed — the concurrency model is cooperative async.

### Re-Execution Safety

The StatefulPrompt system re-runs `promptFn` on each step. Background agents must survive re-execution:

- The job registry lives in `defState`, so it persists across re-executions.
- The actual running Promises are stored in a **module-level Map** (outside of defState, since Promises are not serializable). On re-execution, the plugin checks if a Promise already exists for a job ID before spawning a duplicate.
- An `activePromises: Map<string, { promise: Promise<string>, prompt: StatefulPrompt }>` handles this, keyed by job ID.

```typescript
// Module-level (outside the plugin function)
const activePromises = new Map<string, { promise: Promise<string>, prompt: StatefulPrompt }>();

// Inside spawn tool handler:
if (activePromises.has(jobId)) {
  return { success: true, jobId, message: 'Job already running' };
}
```

---

## Feature 2: Agent Orchestration (`defOrchestratedGraph`)

### Why

THING needs to orchestrate multiple background agents with dependencies — spawn Agent A and B in parallel, then Agent C when both complete. The existing `defTaskGraph` has DAG support and `assigned_subagent` fields but doesn't actually spawn agents.

### New Files

```
org/libs/core/src/plugins/orchestration/
├── orchestration.ts    # Plugin implementation
└── index.ts            # Re-exports
```

### Plugin API

```typescript
export function defOrchestratedGraph(
  this: StatefulPrompt,
  agents: Record<string, {
    execute: (args: any, prompt: StatefulPrompt) => Promise<void>;
    options?: AgentOptions;
  }>,
  tasks: TaskNode[]
): [TaskNode[], (newValue: TaskNode[] | ((prev: TaskNode[]) => TaskNode[])) => void]
```

### How It Works

Composes `defTaskGraph` + `defBackgroundAgent`:

1. **Setup:** Calls `this.defTaskGraph(tasks)` to set up the DAG and calls `this.defBackgroundAgent(...)` for each agent in the registry.

2. **Auto-spawning effect:** A `defEffect` watches for task state changes:
   ```typescript
   this.defEffect(() => {
     const currentTasks = getCurrentTasks();
     const jobs = getCurrentJobs();

     // Find tasks that are pending, have all dependencies completed, and have an assigned_subagent
     const ready = currentTasks.filter(t =>
       t.status === 'pending' &&
       t.assigned_subagent &&
       t.dependencies.every(depId => {
         const dep = currentTasks.find(d => d.id === depId);
         return dep?.status === 'completed';
       }) &&
       !jobs.some(j => j.agentName === t.assigned_subagent && j.id.includes(t.id))
     );

     for (const task of ready) {
       // Build input context from dependency outputs
       const inputContext = t.dependencies
         .map(depId => currentTasks.find(d => d.id === depId))
         .filter(Boolean)
         .map(dep => dep!.output_result)
         .filter(Boolean)
         .join('\n\n');

       // Auto-spawn the background agent
       // (spawn tool is called programmatically, not by LLM)
     }
   }, [taskGraph, backgroundJobs]);
   ```

3. **Auto-completion:** When a background job completes, automatically calls `updateTaskStatus` on the corresponding task with the agent's result as `output_result`, which triggers downstream unblocking.

4. **Result propagation:** Completed agent output becomes `input_context` for dependent nodes, following the existing `spawn`/`fork` node type semantics from defTaskGraph.

### Task-to-Agent Mapping

Uses the existing `assigned_subagent` field on `TaskNode`:

```typescript
const tasks: TaskNode[] = [
  {
    id: 'research', title: 'Research topic', description: '...',
    status: 'pending', dependencies: [], unblocks: ['write'],
    required_capabilities: [], assigned_subagent: 'researcher'
  },
  {
    id: 'write', title: 'Write article', description: '...',
    status: 'pending', dependencies: ['research'], unblocks: [],
    required_capabilities: [], assigned_subagent: 'writer'
  }
];
```

---

## Feature 3: Agent Evaluation (`defEval`)

### Why

Architecture.md: *"Evaluates agents — LLM-as-judge · Human eval"* and *"iteratively test an agent until all metrics pass"*

### New Files

```
org/libs/core/src/plugins/eval/
├── eval.ts    # Plugin implementation
└── index.ts   # Re-exports
```

### Types

Add to `org/libs/core/src/plugins/types.ts`:

```typescript
// ============================================================
// Evaluation Plugin Types
// ============================================================

export interface EvalMetric {
  /** Metric name (e.g., "accuracy", "relevance", "safety") */
  name: string;
  /** What this metric measures */
  description: string;
  /** How to evaluate: LLM judges, human reviews, or code function */
  judge: 'llm' | 'human' | 'code';
  /** System prompt for the LLM judge (required when judge='llm') */
  judgePrompt?: string;
  /** Model for the LLM judge (defaults to parent model) */
  judgeModel?: string;
  /** Code evaluation function (required when judge='code') */
  judgeFn?: (input: any, output: string) => { score: number; feedback: string };
  /** Minimum passing score 0-1 (default: 0.7) */
  passingScore?: number;
}

export interface EvalResult {
  /** Which metric this result is for */
  metricName: string;
  /** Score from 0 to 1 */
  score: number;
  /** Whether the score meets the passing threshold */
  passed: boolean;
  /** Explanation from the judge */
  feedback: string;
  /** How it was evaluated */
  judgeType: 'llm' | 'human' | 'code';
}

export interface EvalRun {
  /** Unique run identifier */
  id: string;
  /** Which iteration of the eval loop (1-based) */
  iteration: number;
  /** Input sent to the target agent */
  input: any;
  /** Output received from the target agent */
  output: string;
  /** Results for each metric */
  metrics: EvalResult[];
  /** Whether all metrics passed */
  allPassed: boolean;
  /** Unix timestamp */
  timestamp: number;
}

export interface RunEvaluationResult {
  success: boolean;
  evalRun: EvalRun;
  message: string;
}

export interface RunEvalLoopResult {
  success: boolean;
  runs: EvalRun[];
  passed: boolean;
  iterations: number;
  message: string;
}
```

### Plugin API

```typescript
export function defEval(
  this: StatefulPrompt,
  config: {
    /** Name of the agent to evaluate (must be registered via defAgent or defBackgroundAgent) */
    targetAgent: string;
    /** Metrics to evaluate against */
    metrics: EvalMetric[];
    /** Maximum improvement iterations (default 3) */
    maxIterations?: number;
  }
): [EvalRun[], (newValue: EvalRun[] | ((prev: EvalRun[]) => EvalRun[])) => void]
```

### What It Registers

| Tool | Purpose |
|------|---------|
| `runEvaluation` | Single eval cycle: run agent with input → judge each metric → record results |
| `runEvalLoop` | Iterate: run evaluation → if failed, return feedback → re-run until all pass or maxIterations |
| `getEvalResults` | Return evaluation history |

### LLM-as-Judge Implementation

Spawns a judge agent via `defAgent` internally:

```typescript
// Inside runEvaluation tool handler:
for (const metric of config.metrics) {
  if (metric.judge === 'llm') {
    const judgePrompt = StatefulPrompt.create(metric.judgeModel || this.getModel());
    judgePrompt.defSystem('judge', [
      'You are an evaluation judge. Score the following agent output.',
      '',
      `## Metric: ${metric.name}`,
      `## Criteria: ${metric.description}`,
      metric.judgePrompt || '',
      '',
      '## Agent Input',
      JSON.stringify(input),
      '',
      '## Agent Output',
      agentOutput,
      '',
      'Respond with ONLY valid JSON: { "score": <0-1>, "feedback": "<explanation>" }'
    ].join('\n'));
    judgePrompt.addMessage({ role: 'user', content: 'Evaluate the output now.' });

    const judgeResult = judgePrompt.run();
    const judgeText = await judgeResult.text;
    const { score, feedback } = JSON.parse(judgeText);

    results.push({
      metricName: metric.name,
      score,
      passed: score >= (metric.passingScore ?? 0.7),
      feedback,
      judgeType: 'llm'
    });
  }
}
```

### Human Evaluation

Uses a `requestHumanEval` tool that presents the input/output to the user:

```typescript
if (metric.judge === 'human') {
  // Register a one-shot tool for this evaluation
  // The parent LLM will relay the request to the human
  results.push({
    metricName: metric.name,
    score: -1,  // pending
    passed: false,
    feedback: `PENDING: Human evaluation needed for "${metric.name}". Present the output to the user and ask them to score it 0-1.`,
    judgeType: 'human'
  });
}
```

### Code Evaluation

Direct function execution:

```typescript
if (metric.judge === 'code' && metric.judgeFn) {
  const { score, feedback } = metric.judgeFn(input, agentOutput);
  results.push({
    metricName: metric.name,
    score,
    passed: score >= (metric.passingScore ?? 0.7),
    feedback,
    judgeType: 'code'
  });
}
```

### Iterative Loop

The `runEvalLoop` tool orchestrates improvement cycles:

```typescript
// Pseudocode for runEvalLoop:
for (let i = 1; i <= maxIterations; i++) {
  const evalRun = await runSingleEvaluation(input);
  evalRuns.push(evalRun);

  if (evalRun.allPassed) {
    return { success: true, runs: evalRuns, passed: true, iterations: i };
  }

  // Return failed metrics with feedback so THING can modify the agent
  // THING decides whether to adjust the agent's instruct.md, knowledge, or config
  // and then calls runEvalLoop again
}

return { success: false, runs: evalRuns, passed: false, iterations: maxIterations };
```

The loop is not fully autonomous — THING (the parent agent) receives the failed metrics with feedback and decides what to adjust before re-running. This matches the Architecture.md pattern: *"THING can iteratively test an agent until all metrics pass"*.

---

## Feature 4: Dataset Generation (`defDataset`)

### Why

Architecture.md: *"THING generates evaluation datasets by creating multiple inputs and running them through Space agents using a large model. The resulting input/output pairs are stored in GitHub/VFS as versioned dataset files."*

### New Files

```
org/libs/core/src/plugins/dataset/
├── dataset.ts    # Plugin implementation
└── index.ts      # Re-exports
```

### Types

Add to `org/libs/core/src/plugins/types.ts`:

```typescript
// ============================================================
// Dataset Plugin Types
// ============================================================

export type DatasetEntryStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DatasetEntry {
  /** Unique entry identifier */
  id: string;
  /** Input sent to the agent */
  input: Record<string, any>;
  /** Output received from the agent (set on completion) */
  output?: string;
  /** Execution status */
  status: DatasetEntryStatus;
  /** Error message (set on failure) */
  error?: string;
  /** Metadata about the generation */
  metadata?: {
    model?: string;
    latencyMs?: number;
    tokenUsage?: { input: number; output: number };
  };
}

export interface DatasetConfig {
  /** Dataset name (used as state key and file name) */
  name: string;
  /** Zod schema for input entries */
  inputSchema: z.ZodType<any>;
  /** Name of the agent to run inputs through */
  targetAgent: string;
  /** Model for generating diverse inputs (defaults to parent model) */
  generationModel?: string;
  /** Number of entries to generate (default 10) */
  count?: number;
  /** Max parallel agent runs (default 3) */
  concurrency?: number;
}

export interface GenerateInputsResult {
  success: boolean;
  entries: DatasetEntry[];
  message: string;
}

export interface RunDatasetBatchResult {
  success: boolean;
  completed: number;
  failed: number;
  total: number;
  message: string;
}

export interface ExportDatasetResult {
  success: boolean;
  content: string;
  format: string;
  entryCount: number;
  message: string;
}
```

### Plugin API

```typescript
export function defDataset(
  this: StatefulPrompt,
  config: DatasetConfig
): [DatasetEntry[], (newValue: DatasetEntry[] | ((prev: DatasetEntry[]) => DatasetEntry[])) => void]
```

### What It Registers

| Tool | Purpose |
|------|---------|
| `generateInputs` | LLM generates diverse inputs matching `inputSchema` |
| `addDatasetEntry` | Manually add a single input/output pair |
| `runDatasetEntry` | Run single input through target agent, capture output |
| `runDatasetBatch` | Run all pending entries (chunked by concurrency) |
| `exportDataset` | Serialize as JSONL string (standard fine-tuning format) |
| `validateDataset` | Check completeness, identify failures |
| `getDatasetStats` | Return counts, coverage, schema info |

### Input Generation

The `generateInputs` tool spawns a generation agent:

```typescript
// Inside generateInputs tool handler:
const genPrompt = StatefulPrompt.create(config.generationModel || this.getModel());
genPrompt.defSystem('generator', [
  'Generate diverse, realistic inputs for testing an AI agent.',
  '',
  `## Input Schema`,
  `${zodToJsonSchema(config.inputSchema)}`,
  '',
  `## Requirements`,
  `- Generate exactly ${count} inputs`,
  `- Each input must be valid against the schema`,
  `- Maximize diversity: vary topics, complexity, edge cases`,
  `- Return as a JSON array`,
].join('\n'));
genPrompt.addMessage({ role: 'user', content: `Generate ${count} diverse inputs.` });

const result = genPrompt.run();
const text = await result.text;
const inputs = JSON.parse(text);

// Validate each against schema, create DatasetEntry objects
```

### Batch Execution

Runs inputs through the target agent with concurrency control:

```typescript
// Inside runDatasetBatch tool handler:
const pending = entries.filter(e => e.status === 'pending');
const concurrency = config.concurrency ?? 3;

// Process in chunks
for (let i = 0; i < pending.length; i += concurrency) {
  const chunk = pending.slice(i, i + concurrency);
  await Promise.all(chunk.map(async (entry) => {
    setEntries(prev => prev.map(e =>
      e.id === entry.id ? { ...e, status: 'running' } : e
    ));

    try {
      const startTime = Date.now();
      // Call the target agent (uses existing defAgent tool)
      const output = await callTargetAgent(entry.input);

      setEntries(prev => prev.map(e =>
        e.id === entry.id ? {
          ...e,
          status: 'completed',
          output,
          metadata: { latencyMs: Date.now() - startTime }
        } : e
      ));
    } catch (err) {
      setEntries(prev => prev.map(e =>
        e.id === entry.id ? { ...e, status: 'failed', error: err.message } : e
      ));
    }
  }));
}
```

### Export Format

JSONL output (standard for fine-tuning):

```jsonl
{"messages":[{"role":"user","content":"...input..."},{"role":"assistant","content":"...output..."}]}
{"messages":[{"role":"user","content":"...input..."},{"role":"assistant","content":"...output..."}]}
```

The `exportDataset` tool returns the JSONL content as a string. The caller (THING or Studio) writes it to VFS (browser) or filesystem (Node.js). The plugin is environment-agnostic.

---

## Feature 5: Fine-Tuning Integration (`defFineTune`)

### Why

Architecture.md: *"fine-tune an SLM — closing the loop from evaluation to training"* and *"$10/GPU-hour ($7 Azure cost), NVIDIA H100 (Azure CycleCloud)"*

### New Core Files

```
org/libs/core/src/plugins/fineTune/
├── fineTune.ts    # Plugin implementation
└── index.ts       # Re-exports
```

### New Cloud Edge Functions

```
cloud/supabase/functions/submit-fine-tune/index.ts
cloud/supabase/functions/fine-tune-status/index.ts
```

### Types

Add to `org/libs/core/src/plugins/types.ts`:

```typescript
// ============================================================
// Fine-Tuning Plugin Types
// ============================================================

export type FineTuneJobStatus = 'pending' | 'submitted' | 'validating' | 'training' | 'completed' | 'failed' | 'cancelled';

export interface FineTuneJob {
  /** Unique job identifier */
  id: string;
  /** Name of the source dataset */
  datasetName: string;
  /** Base model to fine-tune from */
  baseModel: string;
  /** Current training status */
  status: FineTuneJobStatus;
  /** Unix timestamp when submitted */
  submittedAt?: number;
  /** Unix timestamp when training completed */
  completedAt?: number;
  /** The fine-tuned model identifier (set on completion) */
  resultModelId?: string;
  /** Training metrics */
  metrics?: {
    trainingLoss?: number;
    validationLoss?: number;
    trainedTokens?: number;
  };
  /** Error message (set on failure) */
  error?: string;
}

export interface SubmitFineTuneResult {
  success: boolean;
  job?: FineTuneJob;
  message: string;
}

export interface CheckFineTuneStatusResult {
  success: boolean;
  job?: FineTuneJob;
  message: string;
}
```

### Core Plugin API

```typescript
export function defFineTune(
  this: StatefulPrompt,
  config?: {
    /** Cloud URL override (defaults to CLOUD_URL env var) */
    cloudUrl?: string;
  }
): [FineTuneJob[], (newValue: FineTuneJob[] | ((prev: FineTuneJob[]) => FineTuneJob[])) => void]
```

### What It Registers

| Tool | Purpose |
|------|---------|
| `submitFineTune` | POST dataset + base model to `cloud/submit-fine-tune` |
| `checkFineTuneStatus` | GET `cloud/fine-tune-status?jobId=...` |
| `cancelFineTune` | POST `cloud/cancel-fine-tune` |
| `useFineTunedModel` | Returns model ID once training completes |

### Cloud Edge Function: `submit-fine-tune`

```typescript
// cloud/supabase/functions/submit-fine-tune/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCors();

  const { user_id, stripe_customer_id } = await authenticateRequest(req);

  // Validate tier access (fine-tuning requires paid tier)
  // ...

  const { dataset, baseModel, hyperparameters, suffix } = await req.json();

  // Validate JSONL format
  // Upload to provider (initially OpenAI)
  // Create fine-tuning job via provider API
  // Store in Supabase

  const supabase = createSupabaseClient();
  const { data: job } = await supabase
    .from('fine_tune_jobs')
    .insert({
      user_id,
      provider: 'openai',
      provider_job_id: providerJobId,
      base_model: baseModel,
      status: 'submitted',
      hyperparameters,
    })
    .select()
    .single();

  return new Response(JSON.stringify({ success: true, job }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

### Cloud Edge Function: `fine-tune-status`

```typescript
// cloud/supabase/functions/fine-tune-status/index.ts
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCors();

  const { user_id } = await authenticateRequest(req);
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');

  const supabase = createSupabaseClient();
  const { data: job } = await supabase
    .from('fine_tune_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', user_id)
    .single();

  if (!job) return new Response(JSON.stringify({ success: false, message: 'Job not found' }), { status: 404 });

  // Optionally refresh status from provider API
  // Update Supabase if status changed

  return new Response(JSON.stringify({ success: true, job }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

### Database Migration

```sql
CREATE TABLE fine_tune_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL,
  provider_job_id TEXT NOT NULL,
  base_model TEXT NOT NULL,
  fine_tuned_model TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  hyperparameters JSONB,
  metrics JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE fine_tune_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fine-tune jobs"
  ON fine_tune_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create fine-tune jobs"
  ON fine_tune_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fine-tune jobs"
  ON fine_tune_jobs FOR UPDATE
  USING (auth.uid() = user_id);
```

---

## Integration: StatefulPrompt & Plugin Registry

### StatefulPrompt Stub Methods

Add to `org/libs/core/src/StatefulPrompt.ts` (after line 893, following existing pattern):

```typescript
/**
 * Spawn a background agent that runs independently.
 * @category Plugins
 */
defBackgroundAgent(
  name: string,
  description: string,
  inputSchema: z.ZodType<any>,
  execute: (args: any, prompt: StatefulPrompt) => Promise<void>,
  options?: AgentOptions & { maxConcurrent?: number }
): void {
  return this._callPluginMethod('defBackgroundAgent', name, description, inputSchema, execute, options);
}

/**
 * Define an orchestrated graph of background agents with DAG dependencies.
 * @category Plugins
 */
defOrchestratedGraph(
  agents: Record<string, { execute: Function; options?: AgentOptions }>,
  tasks: TaskNode[]
): [TaskNode[], (newValue: TaskNode[] | ((prev: TaskNode[]) => TaskNode[])) => void] {
  return this._callPluginMethod('defOrchestratedGraph', agents, tasks);
}

/**
 * Define an agent evaluation framework with metrics and iterative testing.
 * @category Plugins
 */
defEval(config: {
  targetAgent: string;
  metrics: EvalMetric[];
  maxIterations?: number;
}): [EvalRun[], (newValue: EvalRun[] | ((prev: EvalRun[]) => EvalRun[])) => void] {
  return this._callPluginMethod('defEval', config);
}

/**
 * Define a dataset for agent evaluation and fine-tuning.
 * @category Plugins
 */
defDataset(config: DatasetConfig): [DatasetEntry[], (newValue: DatasetEntry[] | ((prev: DatasetEntry[]) => DatasetEntry[])) => void] {
  return this._callPluginMethod('defDataset', config);
}

/**
 * Define a fine-tuning integration for training SLMs.
 * @category Plugins
 */
defFineTune(config?: { cloudUrl?: string }): [FineTuneJob[], (newValue: FineTuneJob[] | ((prev: FineTuneJob[]) => FineTuneJob[])) => void] {
  return this._callPluginMethod('defFineTune', config);
}
```

### Plugin Registry

Update `org/libs/core/src/plugins/index.ts`:

```typescript
import { backgroundAgentPlugin } from './backgroundAgent';
import { orchestrationPlugin } from './orchestration';
import { evalPlugin } from './eval';
import { datasetPlugin } from './dataset';
import { fineTunePlugin } from './fineTune';

export { backgroundAgentPlugin, defBackgroundAgent } from './backgroundAgent';
export { orchestrationPlugin, defOrchestratedGraph } from './orchestration';
export { evalPlugin, defEval } from './eval';
export { datasetPlugin, defDataset } from './dataset';
export { fineTunePlugin, defFineTune } from './fineTune';

export const builtInPlugins = [
  taskListPlugin, taskGraphPlugin, functionPlugin, zeroStepPlugin,
  knowledgeAgentPlugin, backgroundAgentPlugin, orchestrationPlugin,
  evalPlugin, datasetPlugin, fineTunePlugin
] as const;
```

### _getPromptMethods

Add to `org/libs/core/src/StatefulPrompt.ts` (in the `_getPromptMethods()` method):

```typescript
defBackgroundAgent: this.defBackgroundAgent.bind(this),
defOrchestratedGraph: this.defOrchestratedGraph.bind(this),
defEval: this.defEval.bind(this),
defDataset: this.defDataset.bind(this),
defFineTune: this.defFineTune.bind(this),
```

---

## End-to-End: How THING Uses These Features

### Scenario: User asks THING to build a math tutor agent

```typescript
const { result } = await runPrompt(async ({
  defKnowledgeAgent, defBackgroundAgent, defEval, defDataset, defFineTune, $
}) => {
  // 1. THING creates the agent space (using space-creator knowledge agents)
  defKnowledgeAgent('./spaces/space-creator', './spaces/space-creator/agents/agent-space-architect');

  // 2. Register a background agent for testing the math tutor
  defBackgroundAgent('mathTutor', 'A math tutoring agent', mathTutorSchema, async (args, prompt) => {
    defKnowledgeAgent('./spaces/math-tutor', './spaces/math-tutor/agents/agent-tutor');
    prompt.addMessage({ role: 'user', content: args.question });
  });

  // 3. Set up evaluation
  const [evalRuns] = defEval({
    targetAgent: 'mathTutor',
    metrics: [
      { name: 'accuracy', description: 'Math answer is correct', judge: 'llm',
        judgePrompt: 'Check if the math answer is correct.', passingScore: 0.9 },
      { name: 'explanation', description: 'Explanation is clear', judge: 'llm',
        judgePrompt: 'Is the explanation clear for a student?', passingScore: 0.7 },
    ],
    maxIterations: 3
  });

  // 4. Set up dataset generation
  const [dataset] = defDataset({
    name: 'math-tutor-training',
    inputSchema: z.object({ question: z.string(), difficulty: z.enum(['easy', 'medium', 'hard']) }),
    targetAgent: 'mathTutor',
    count: 50,
    concurrency: 5
  });

  // 5. Set up fine-tuning
  const [ftJobs] = defFineTune();

  $`Build a math tutor agent. Use the SpaceArchitect to create the space structure.
    Then evaluate it with runEvalLoop. If it passes, generate a training dataset
    and submit for fine-tuning.`;
}, { model: 'anthropic:claude-sonnet-4-20250514' });
```

### The Full Loop

```
THING receives request
  → Creates agent space (via space-creator agents)
  → Tests agent with runEvaluation
  → If metrics fail: adjusts instruct.md/knowledge, re-evaluates (up to maxIterations)
  → When all metrics pass: generates dataset with generateInputs + runDatasetBatch
  → Exports dataset as JSONL
  → Submits for fine-tuning via submitFineTune
  → Monitors training with checkFineTuneStatus
  → Updates agent config with fine-tuned model via useFineTunedModel
```

---

## Implementation Order

```
Phase 1: defBackgroundAgent     ← foundation, everything else builds on this
Phase 2: defOrchestratedGraph   ← extends background agents with DAG dependencies
Phase 3: defEval                ← uses defAgent for judges, depends on spawning target agents
Phase 4: defDataset             ← uses agents for concurrent I/O pair generation
Phase 5: defFineTune            ← uses defDataset output, needs cloud edge functions
```

Each phase is independently shippable and testable.

---

## Testing Strategy

### Integration Tests

Each plugin gets an integration test in `org/libs/core/tests/integration/` following the pattern in `defKnowledgeAgent.test.ts`:

```typescript
// Example: defBackgroundAgent.test.ts
import { runPrompt } from '../../src/runPrompt';
import { createMockModel } from '../../src/test/mockModel';

describe('defBackgroundAgent', () => {
  it('spawns and completes a background agent', async () => {
    const mockModel = createMockModel([
      // Parent: spawn the agent
      { type: 'tool-call', toolName: 'spawn_researcher', args: { topic: 'AI' } },
      // Parent: check status
      { type: 'tool-call', toolName: 'checkJobStatus', args: { jobId: '...' } },
      // Parent: get result
      { type: 'tool-call', toolName: 'getJobResult', args: { jobId: '...' } },
      { type: 'text', text: 'Research complete.' }
    ]);

    const { result } = await runPrompt(async ({ defBackgroundAgent, $ }) => {
      defBackgroundAgent('researcher', 'Research topics',
        z.object({ topic: z.string() }),
        async (args, prompt) => {
          prompt.addMessage({ role: 'user', content: `Research ${args.topic}` });
        }
      );
      $`Spawn the researcher agent to study AI, then get the result.`;
    }, { model: mockModel });

    const text = await result.text;
    expect(text.length).toBeGreaterThan(0);
  });
});
```

### Run Tests

```bash
cd org/libs/core && pnpm test
```

### End-to-End Verification

Use `lmthing run` CLI with a `.lmt.mjs` file that exercises the full THING loop:

```javascript
// test-thing.lmt.mjs
export default async function({ defBackgroundAgent, defEval, $ }) {
  defBackgroundAgent('helper', 'A helpful agent',
    z.object({ task: z.string() }),
    async (args, prompt) => {
      prompt.addMessage({ role: 'user', content: args.task });
    }
  );

  defEval({
    targetAgent: 'helper',
    metrics: [{ name: 'quality', description: 'Response quality', judge: 'llm', passingScore: 0.7 }],
  });

  $`Spawn the helper agent with task "explain recursion", then evaluate the response.`;
}

export const config = { model: 'openai:gpt-4o' };
```

Run: `npx lmthing run test-thing.lmt.mjs`

---

## Files Summary

### New Files (Core)

| File | Plugin |
|------|--------|
| `org/libs/core/src/plugins/backgroundAgent/backgroundAgent.ts` | defBackgroundAgent |
| `org/libs/core/src/plugins/backgroundAgent/index.ts` | Re-exports |
| `org/libs/core/src/plugins/orchestration/orchestration.ts` | defOrchestratedGraph |
| `org/libs/core/src/plugins/orchestration/index.ts` | Re-exports |
| `org/libs/core/src/plugins/eval/eval.ts` | defEval |
| `org/libs/core/src/plugins/eval/index.ts` | Re-exports |
| `org/libs/core/src/plugins/dataset/dataset.ts` | defDataset |
| `org/libs/core/src/plugins/dataset/index.ts` | Re-exports |
| `org/libs/core/src/plugins/fineTune/fineTune.ts` | defFineTune |
| `org/libs/core/src/plugins/fineTune/index.ts` | Re-exports |

### New Files (Cloud)

| File | Purpose |
|------|---------|
| `cloud/supabase/functions/submit-fine-tune/index.ts` | Submit fine-tuning job |
| `cloud/supabase/functions/fine-tune-status/index.ts` | Check fine-tuning status |

### Modified Files

| File | Changes |
|------|---------|
| `org/libs/core/src/plugins/types.ts` | Add BackgroundJob, EvalMetric, EvalResult, EvalRun, DatasetEntry, FineTuneJob types |
| `org/libs/core/src/plugins/index.ts` | Import and register 5 new plugins in builtInPlugins |
| `org/libs/core/src/StatefulPrompt.ts` | Add 5 stub methods + _getPromptMethods entries |
| `org/libs/core/src/index.ts` | Re-export new plugin types |

### Test Files

| File | Tests |
|------|-------|
| `org/libs/core/tests/integration/defBackgroundAgent.test.ts` | Spawn, poll, progress, concurrency |
| `org/libs/core/tests/integration/defOrchestratedGraph.test.ts` | DAG execution, auto-spawning |
| `org/libs/core/tests/integration/defEval.test.ts` | LLM judge, code judge, eval loop |
| `org/libs/core/tests/integration/defDataset.test.ts` | Generation, batch execution, export |
| `org/libs/core/tests/integration/defFineTune.test.ts` | Submit, status polling |
