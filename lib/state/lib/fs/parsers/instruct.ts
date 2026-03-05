// src/lib/fs/parsers/instruct.ts

import { parseFrontmatter, serializeFrontmatter } from './frontmatter'

export interface AgentInstruct {
  name: string
  description?: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  instructions: string
}

export function parseAgentInstruct(content: string): AgentInstruct {
  const { frontmatter, content: body } = parseFrontmatter<{
    name?: string
    description?: string
    model?: string
    temperature?: number
    'max-tokens'?: number
    'system-prompt'?: string
  }>(content)

  return {
    name: frontmatter.name ?? '',
    description: frontmatter.description,
    model: frontmatter.model,
    temperature: frontmatter.temperature,
    maxTokens: frontmatter['max-tokens'],
    systemPrompt: frontmatter['system-prompt'],
    instructions: body.trim()
  }
}

export function serializeAgentInstruct(instruct: AgentInstruct): string {
  return serializeFrontmatter({
    name: instruct.name,
    ...(instruct.description && { description: instruct.description }),
    ...(instruct.model && { model: instruct.model }),
    ...(instruct.temperature !== undefined && { temperature: instruct.temperature }),
    ...(instruct.maxTokens !== undefined && { 'max-tokens': instruct.maxTokens }),
    ...(instruct.systemPrompt && { 'system-prompt': instruct.systemPrompt })
  }, instruct.instructions)
}
