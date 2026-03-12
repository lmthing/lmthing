// src/lib/fs/parsers/task.ts

import { parseFrontmatter, serializeFrontmatter } from './frontmatter'

export interface FlowTask {
  name: string
  description?: string
  agent?: string
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  content: string
}

export function parseFlowTask(content: string): FlowTask {
  const { frontmatter, content: body } = parseFrontmatter<{
    name?: string
    description?: string
    agent?: string
    inputs?: Record<string, unknown>
    outputs?: Record<string, unknown>
  }>(content)

  return {
    name: frontmatter.name ?? '',
    description: frontmatter.description,
    agent: frontmatter.agent,
    inputs: frontmatter.inputs,
    outputs: frontmatter.outputs,
    content: body.trim()
  }
}

export function serializeFlowTask(task: FlowTask): string {
  return serializeFrontmatter({
    name: task.name,
    ...(task.description && { description: task.description }),
    ...(task.agent && { agent: task.agent }),
    ...(task.inputs && { inputs: task.inputs }),
    ...(task.outputs && { outputs: task.outputs })
  }, task.content)
}

// Parse flow index file
export interface FlowIndex {
  name: string
  description?: string
  tasks: string[]
}

export function parseFlowIndex(content: string): FlowIndex {
  const { frontmatter, content: body } = parseFrontmatter<{
    name?: string
    description?: string
  }>(content)

  // Tasks are listed as markdown links: - [Task Name](01.task-name.md)
  const taskRegex = /^-\s*\[([^\]]+)\]\(([^)]+)\)\s*$/gm
  const tasks: string[] = []
  let match

  while ((match = taskRegex.exec(body)) !== null) {
    tasks.push(match[2])
  }

  return {
    name: frontmatter.name ?? '',
    description: frontmatter.description,
    tasks
  }
}

export function serializeFlowIndex(index: FlowIndex): string {
  const taskList = index.tasks
    .map(t => {
      const name = t.replace(/^\d+\./, '').replace(/\.md$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      return `- [${name}](${t})`
    })
    .join('\n')

  return serializeFrontmatter({
    name: index.name,
    ...(index.description && { description: index.description })
  }, taskList)
}
