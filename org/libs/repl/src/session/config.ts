import { z } from 'zod'

export interface SessionConfig {
  functionTimeout: number
  askTimeout: number
  sessionTimeout: number
  maxStopCalls: number
  maxAsyncTasks: number
  maxTasklistReminders: number
  maxContextTokens: number
  serializationLimits: {
    maxStringLength: number
    maxArrayElements: number
    maxObjectKeys: number
    maxDepth: number
  }
  workspace: {
    maxScopeVariables: number
    maxScopeValueWidth: number
    maxScopeTokens: number
  }
  contextWindow: {
    codeWindowLines: number
    stopDecayTiers: {
      full: number
      keysOnly: number
      summary: number
    }
    neverTruncateInterventions: boolean
  }
}

const DEFAULT_CONFIG: SessionConfig = {
  functionTimeout: 30_000,
  askTimeout: 300_000,
  sessionTimeout: 600_000,
  maxStopCalls: 50,
  maxAsyncTasks: 10,
  maxTasklistReminders: 3,
  maxContextTokens: 100_000,
  serializationLimits: {
    maxStringLength: 2_000,
    maxArrayElements: 50,
    maxObjectKeys: 20,
    maxDepth: 5,
  },
  workspace: {
    maxScopeVariables: 50,
    maxScopeValueWidth: 50,
    maxScopeTokens: 3_000,
  },
  contextWindow: {
    codeWindowLines: 200,
    stopDecayTiers: {
      full: 2,
      keysOnly: 5,
      summary: 10,
    },
    neverTruncateInterventions: true,
  },
}

export function createDefaultConfig(): SessionConfig {
  return structuredClone(DEFAULT_CONFIG)
}

const sessionConfigSchema = z.object({
  functionTimeout: z.number().positive().optional(),
  askTimeout: z.number().positive().optional(),
  sessionTimeout: z.number().positive().optional(),
  maxStopCalls: z.number().int().positive().optional(),
  maxAsyncTasks: z.number().int().positive().optional(),
  maxTasklistReminders: z.number().int().positive().optional(),
  maxContextTokens: z.number().int().positive().optional(),
  serializationLimits: z.object({
    maxStringLength: z.number().int().positive().optional(),
    maxArrayElements: z.number().int().positive().optional(),
    maxObjectKeys: z.number().int().positive().optional(),
    maxDepth: z.number().int().positive().optional(),
  }).optional(),
  workspace: z.object({
    maxScopeVariables: z.number().int().positive().optional(),
    maxScopeValueWidth: z.number().int().positive().optional(),
    maxScopeTokens: z.number().int().positive().optional(),
  }).optional(),
  contextWindow: z.object({
    codeWindowLines: z.number().int().positive().optional(),
    stopDecayTiers: z.object({
      full: z.number().int().nonnegative().optional(),
      keysOnly: z.number().int().nonnegative().optional(),
      summary: z.number().int().nonnegative().optional(),
    }).optional(),
    neverTruncateInterventions: z.boolean().optional(),
  }).optional(),
})

export type PartialSessionConfig = z.infer<typeof sessionConfigSchema>

export function validateConfig(input: unknown): { valid: true; config: PartialSessionConfig } | { valid: false; errors: string[] } {
  const result = sessionConfigSchema.safeParse(input)
  if (result.success) {
    return { valid: true, config: result.data }
  }
  return {
    valid: false,
    errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
  }
}

export function mergeConfig(overrides: PartialSessionConfig): SessionConfig {
  const base = createDefaultConfig()
  return {
    functionTimeout: overrides.functionTimeout ?? base.functionTimeout,
    askTimeout: overrides.askTimeout ?? base.askTimeout,
    sessionTimeout: overrides.sessionTimeout ?? base.sessionTimeout,
    maxStopCalls: overrides.maxStopCalls ?? base.maxStopCalls,
    maxAsyncTasks: overrides.maxAsyncTasks ?? base.maxAsyncTasks,
    maxTasklistReminders: overrides.maxTasklistReminders ?? base.maxTasklistReminders,
    maxContextTokens: overrides.maxContextTokens ?? base.maxContextTokens,
    serializationLimits: {
      maxStringLength: overrides.serializationLimits?.maxStringLength ?? base.serializationLimits.maxStringLength,
      maxArrayElements: overrides.serializationLimits?.maxArrayElements ?? base.serializationLimits.maxArrayElements,
      maxObjectKeys: overrides.serializationLimits?.maxObjectKeys ?? base.serializationLimits.maxObjectKeys,
      maxDepth: overrides.serializationLimits?.maxDepth ?? base.serializationLimits.maxDepth,
    },
    workspace: {
      maxScopeVariables: overrides.workspace?.maxScopeVariables ?? base.workspace.maxScopeVariables,
      maxScopeValueWidth: overrides.workspace?.maxScopeValueWidth ?? base.workspace.maxScopeValueWidth,
      maxScopeTokens: overrides.workspace?.maxScopeTokens ?? base.workspace.maxScopeTokens,
    },
    contextWindow: {
      codeWindowLines: overrides.contextWindow?.codeWindowLines ?? base.contextWindow.codeWindowLines,
      stopDecayTiers: {
        full: overrides.contextWindow?.stopDecayTiers?.full ?? base.contextWindow.stopDecayTiers.full,
        keysOnly: overrides.contextWindow?.stopDecayTiers?.keysOnly ?? base.contextWindow.stopDecayTiers.keysOnly,
        summary: overrides.contextWindow?.stopDecayTiers?.summary ?? base.contextWindow.stopDecayTiers.summary,
      },
      neverTruncateInterventions: overrides.contextWindow?.neverTruncateInterventions ?? base.contextWindow.neverTruncateInterventions,
    },
  }
}
