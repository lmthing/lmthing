/** Shared data shapes between the local client (pusher) and the cluster app. */

export interface RunRecord {
  task: string
  round: number
  attempt: number
  bin: string
  outcome: string // running | done | interrupted | error | limit | abandoned | skipped
  subtype?: string | null
  isError?: boolean
  costUsd?: number | null
  usage?: unknown
  startedAt?: string | null
  endedAt?: string | null
  resetAt?: string | null
}

export interface CampaignState {
  tasks: Record<string, { round: number }>
  runs: RunRecord[]
  updatedAt?: string
}

/** runtime.json — the live scheduler view (shape from automation/lib/loop.mjs). */
export interface RuntimeState {
  running?: boolean
  paused?: boolean
  slots?: Array<SlotState>
  activeBin?: { bin?: string; limitedUntil?: string | null }
  nextRunAt?: string | null
  updatedAt?: string
  [k: string]: unknown
}

export interface SlotState {
  task?: string
  round?: number
  attempt?: number
  bin?: string
  pid?: number
  child?: { sessionId?: string; model?: string }
  lastResult?: { activity?: string; tool?: string; usage?: unknown; costUsd?: number }
  readyAt?: string | null
  [k: string]: unknown
}

export interface CheckpointUser {
  label?: string
  email?: string
  userId?: string
  pod?: string
}

export interface Checkpoint {
  sessionId?: string
  projectId?: string
  user?: CheckpointUser
  acts?: Record<string, unknown>
  summary?: { total?: number; passed?: number; issues?: number }
  done?: boolean
  facts?: Record<string, unknown>
}

export interface AttemptArtifacts {
  round: number
  attempt: number
  result?: RunRecord
  outputLog?: string
  promptMd?: string
  progressMd?: string
  /** Live-tailed output.jsonl lines (stream-json events). */
  transcript?: unknown[]
}

export interface ScenarioData {
  id: string
  campaignState?: CampaignState
  runtime?: RuntimeState
  scenarioMd?: string
  checkpoint?: Checkpoint
  attempts: Record<string, AttemptArtifacts> // key `${round}:${attempt}`
  user?: { label?: string; userId?: string; email?: string }
  /**
   * For LOCAL-target scenarios (checkpoint.user.userId like `local-*`), the pod runs
   * on the client's machine behind NAT — unreachable from the in-cluster app. The
   * client pushes the pod's data here and the app serves it from this snapshot instead
   * of dialing cluster DNS. Absent for real cluster pods (dashboard proxies those live).
   */
  podBundle?: PodBundle
  updatedAt: number
}

/** A snapshot of one local scenario's pod, pushed by the client. */
export interface PodBundle {
  projectId: string
  updatedAt: number
  /** fs tree paths under `<projectId>/` (from GET /api/fs/tree, filtered to the project). */
  tree: string[]
  /** path → text content (capped; binary/oversized files omitted). */
  files: Record<string, string>
  /** THING session trace events (GET /api/sessions/:sid/events), accumulated by seq. */
  events: unknown[]
  /** Project-app manifest (GET /api/projects/:id/app). */
  manifest?: unknown
  /** Served-app HTML at `/app/<projectId>/` + its referenced assets. */
  app?: {
    html: string
    /** asset path (relative to `/app/<projectId>/`) → body + content-type. */
    assets: Record<string, { body: string; contentType: string; base64?: boolean }>
  }
}

/** A single line of the Claude -p stream-json transcript (output.jsonl). */
export interface TranscriptLine {
  type: string
  subtype?: string
  [k: string]: unknown
}
