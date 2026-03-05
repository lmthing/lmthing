// src/lib/fs/parsers/config.ts

export interface AgentConfig {
  enabled?: boolean
  model?: string
  temperature?: number
  maxTokens?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stopSequences?: string[]
  timeout?: number
  retries?: number
  [key: string]: unknown
}

export function parseAgentConfig(content: string): AgentConfig {
  try {
    return JSON.parse(content) as AgentConfig
  } catch {
    return {}
  }
}

export function serializeAgentConfig(config: AgentConfig): string {
  return JSON.stringify(config, null, 2)
}

export interface AgentValues {
  [key: string]: string | number | boolean | null
}

export function parseAgentValues(content: string): AgentValues {
  try {
    return JSON.parse(content) as AgentValues
  } catch {
    return {}
  }
}

export function serializeAgentValues(values: AgentValues): string {
  return JSON.stringify(values, null, 2)
}

export interface KnowledgeConfig {
  title?: string
  description?: string
  tags?: string[]
  embeddingModel?: string
  chunkSize?: number
  chunkOverlap?: number
  [key: string]: unknown
}

export function parseKnowledgeConfig(content: string): KnowledgeConfig {
  try {
    return JSON.parse(content) as KnowledgeConfig
  } catch {
    return {}
  }
}

export function serializeKnowledgeConfig(config: KnowledgeConfig): string {
  return JSON.stringify(config, null, 2)
}
