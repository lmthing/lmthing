/**
 * Types for the lmthing global API benchmark system.
 *
 * Two categories of benchmark scenarios:
 *   - BenchScenario: TypeScript objects for basic/intermediate tests that mock
 *     individual globals and verify call arguments / sandbox variable values.
 *   - Complex scenarios: full lmthing space directories under benchmark/spaces/
 *     loaded via runAgent() with end-to-end stop() output verification.
 */

import type { Sandbox } from '../sandbox/sandbox'

// ── Model sizes ──────────────────────────────────────────────────────────────

export const MODEL_SIZES = {
  pico:   process.env.LMTHING_MODEL_PICO   ?? 'gpt-3.5-turbo',
  micro:  process.env.LMTHING_MODEL_MICRO  ?? 'gpt-4o-mini',
  nano:   process.env.LMTHING_MODEL_NANO   ?? 'gpt-4o-mini',
  medium: process.env.LMTHING_MODEL_MEDIUM ?? 'gpt-4o',
  large:  process.env.LMTHING_MODEL_LARGE  ?? 'gpt-4-turbo',
} as const

export type ModelSize = keyof typeof MODEL_SIZES

export const ALL_SIZES: ModelSize[] = Object.keys(MODEL_SIZES) as ModelSize[]

// ── Mock function interface ───────────────────────────────────────────────────
// Structural match for vi.fn() — avoids importing vitest in the types file.

export interface MockFn {
  mock: {
    calls: unknown[][]
    results: Array<{ type: 'return' | 'throw'; value: unknown }>
  }
}

export type MockGlobals = Record<string, MockFn>

// ── Basic / intermediate scenarios ───────────────────────────────────────────

export interface BenchScenario {
  /** Unique identifier (kebab-case) */
  id: string
  /** Global(s) under test */
  global: string | string[]
  difficulty: 'basic' | 'intermediate'
  /**
   * The system prompt documentation fragment sent to the LLM.
   * Taken verbatim from buildSystemPrompt.ts (the ### heading block for that global).
   */
  systemPromptDoc: string
  /** Concrete task instruction sent as the user message. */
  userPrompt: string
  /**
   * Verification function. Called after sandbox execution.
   * Return true = pass, false / throw = fail.
   */
  verify: (sandbox: Sandbox, globals: MockGlobals) => boolean | Promise<boolean>
  /** Human-readable description of the expected outcome. */
  expectedDescription: string
  /** Per-test timeout in ms (default 30_000). */
  timeoutMs?: number
  /**
   * When true, runner creates a sandbox with real snapshotScope/restoreScope
   * wired into the checkpoint/rollback globals instead of plain mocks.
   */
  needsWiredCheckpoint?: boolean
}

// ── Benchmark results ─────────────────────────────────────────────────────────

export interface BenchResult {
  scenarioId: string
  modelSize: ModelSize
  model: string
  passed: boolean
  /** The TypeScript code the LLM generated. */
  generatedCode: string
  error?: string
  durationMs: number
}

export interface BenchReport {
  timestamp: string
  results: BenchResult[]
  summary: Record<ModelSize, { passed: number; total: number; passRate: number }>
  byDifficulty: Record<string, Record<ModelSize, { passed: number; total: number }>>
  failingScenarios: Array<{
    scenarioId: string
    modelSize: ModelSize
    code: string
    error: string
    global: string | string[]
  }>
}

// ── Prompt evolution ──────────────────────────────────────────────────────────

export interface PromptImprovement {
  /** Global name (e.g. "stop", "checkpoint") */
  global: string
  originalDescription: string
  improvedDescription: string
  failingModelSize: ModelSize
  /** True if the improved description was verified to fix the failing scenario. */
  verifiedPassing: boolean
  lineStart: number
  lineEnd: number
  /** First line of the section — use as anchor for find/replace. */
  searchPattern: string
}
