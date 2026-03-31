/**
 * Agent loader — reads agent config, instructions, flows, and resolves
 * functions/components/knowledge from a space directory.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ── Types ──

export interface AgentAction {
  id: string
  label: string
  description: string
  flow: string
}

export interface LoadedAgent {
  title: string
  model?: string
  instruct: string
  actions: AgentAction[]
  knowledgeDefaults: Record<string, any>
  catalogModules: string[]
  localFunctions: string[]
  componentRefs: string[]
  enabledAgents: Record<string, string[] | true>
  /** MCP server configs declared in config.json under the "mcp" key */
  mcpServers: Record<string, { command?: string; args?: string[]; env?: Record<string, string>; url?: string; headers?: Record<string, string> }>
}

export interface FlowStep {
  number: number
  name: string
  id: string
  description: string
  instructions: string
  outputTarget?: string
  outputSchema?: Record<string, any>
}

export interface ParsedFlow {
  name: string
  description: string
  steps: FlowStep[]
}

export interface KnowledgeConfig {
  hiddenFields: Map<string, Set<string>>
  preloadOptions: Array<{ domain: string; field: string; option: string }>
}

export interface ResolvedComponents {
  localPaths: string[]
  catalogGroups: string[]
}

// ── Agent loading ──

export function loadAgent(spaceDir: string, agentSlug: string): LoadedAgent {
  const agentDir = resolve(spaceDir, 'agents', agentSlug)

  // Read config.json
  const configPath = join(agentDir, 'config.json')
  if (!existsSync(configPath)) {
    throw new Error(`Agent config not found: ${configPath}`)
  }
  const config = JSON.parse(readFileSync(configPath, 'utf-8'))

  // Read instruct.md
  const instructPath = join(agentDir, 'instruct.md')
  if (!existsSync(instructPath)) {
    throw new Error(`Agent instruct not found: ${instructPath}`)
  }
  const instructContent = readFileSync(instructPath, 'utf-8')
  const parsed = parseInstructFrontmatter(instructContent)

  // Separate functions: catalog/* entries vs local functions
  const catalogModules: string[] = []
  const localFunctions: string[] = []
  const functions = config.functions ?? []

  for (const entry of functions) {
    if (typeof entry === 'string') {
      if (entry.startsWith('catalog/')) {
        catalogModules.push(entry.slice('catalog/'.length))
      } else {
        localFunctions.push(entry)
      }
    } else if (Array.isArray(entry) && typeof entry[0] === 'string') {
      const id = entry[0] as string
      if (id.startsWith('catalog/')) {
        catalogModules.push(id.slice('catalog/'.length))
        // Config (entry[1]) extracted but not enforced yet
      } else {
        localFunctions.push(id)
      }
    }
  }

  return {
    title: parsed.title,
    model: parsed.model,
    instruct: parsed.body,
    actions: parsed.actions,
    knowledgeDefaults: config.knowledge ?? {},
    catalogModules,
    localFunctions,
    componentRefs: config.components ?? [],
    enabledAgents: config.agents ?? {},
    mcpServers: config.mcp ?? {},
  }
}

// ── Frontmatter parsing ──

export function parseInstructFrontmatter(content: string): {
  title: string
  model?: string
  actions: AgentAction[]
  body: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n*([\s\S]*)$/)
  if (!match) {
    return { title: 'Agent', actions: [], body: content.trim() }
  }

  const [, frontmatter, body] = match
  const lines = frontmatter.split('\n')

  let title = 'Agent'
  let model: string | undefined
  const actions: AgentAction[] = []
  let inActions = false
  let currentAction: Partial<AgentAction> = {}

  for (const line of lines) {
    // Detect top-level scalar
    const scalarMatch = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/)
    if (scalarMatch && !inActions) {
      const [, key, raw] = scalarMatch
      const value = raw.trim().replace(/^["']|["']$/g, '')
      if (key === 'title') title = value
      else if (key === 'model') model = value
      continue
    }

    // Detect actions array start
    if (line.match(/^actions\s*:\s*$/)) {
      inActions = true
      continue
    }

    if (inActions) {
      // New action item
      const itemMatch = line.match(/^\s+-\s+(\w[\w-]*)\s*:\s*(.+)$/)
      if (itemMatch) {
        const [, key, raw] = itemMatch
        const value = raw.trim().replace(/^["']|["']$/g, '')
        if (key === 'id') {
          // Save previous action if complete
          if (currentAction.id) {
            actions.push(currentAction as AgentAction)
          }
          currentAction = { id: value }
        } else {
          (currentAction as any)[key] = value
        }
        continue
      }

      // Continuation field within current action
      const fieldMatch = line.match(/^\s+(\w[\w-]*)\s*:\s*(.+)$/)
      if (fieldMatch && currentAction.id) {
        const [, key, raw] = fieldMatch
        const value = raw.trim().replace(/^["']|["']$/g, '')
        ;(currentAction as any)[key] = value
        continue
      }

      // If we hit a non-indented line, stop parsing actions
      if (line.trim() && !line.startsWith(' ') && !line.startsWith('\t')) {
        if (currentAction.id) actions.push(currentAction as AgentAction)
        inActions = false
      }
    }
  }

  // Flush last action
  if (inActions && currentAction.id) {
    actions.push(currentAction as AgentAction)
  }

  return { title, model, actions, body: body.trim() }
}

// ── Function resolution ──

export function resolveLocalFunctions(spaceDir: string, names: string[]): string[] {
  const functionsDir = resolve(spaceDir, 'functions')
  const paths: string[] = []

  for (const name of names) {
    const tsxPath = join(functionsDir, `${name}.tsx`)
    const tsPath = join(functionsDir, `${name}.ts`)
    if (existsSync(tsxPath)) paths.push(tsxPath)
    else if (existsSync(tsPath)) paths.push(tsPath)
  }

  return paths
}

// ── Component resolution ──

export function resolveAgentComponents(spaceDir: string, componentRefs: string[]): ResolvedComponents {
  const localPaths: string[] = []
  const catalogGroups: string[] = []

  for (const ref of componentRefs) {
    // catalog/component/form/* → extract group name
    const catalogMatch = ref.match(/^catalog\/component\/(\w+)\/\*$/)
    if (catalogMatch) {
      catalogGroups.push(catalogMatch[1])
      continue
    }

    // Local component — try view/ then form/ directories
    const viewTsx = join(spaceDir, 'components', 'view', `${ref}.tsx`)
    const viewTs = join(spaceDir, 'components', 'view', `${ref}.ts`)
    const formTsx = join(spaceDir, 'components', 'form', `${ref}.tsx`)
    const formTs = join(spaceDir, 'components', 'form', `${ref}.ts`)

    if (existsSync(viewTsx)) localPaths.push(viewTsx)
    else if (existsSync(viewTs)) localPaths.push(viewTs)
    else if (existsSync(formTsx)) localPaths.push(formTsx)
    else if (existsSync(formTs)) localPaths.push(formTs)
  }

  return { localPaths, catalogGroups }
}

// ── Knowledge config ──

export function resolveKnowledgeConfig(knowledgeDefaults: Record<string, any>): KnowledgeConfig {
  const hiddenFields = new Map<string, Set<string>>()
  const preloadOptions: KnowledgeConfig['preloadOptions'] = []

  for (const [domain, fields] of Object.entries(knowledgeDefaults)) {
    if (typeof fields !== 'object' || fields === null) continue

    for (const [field, value] of Object.entries(fields as Record<string, any>)) {
      if (value === false) {
        // Hide this field
        if (!hiddenFields.has(domain)) hiddenFields.set(domain, new Set())
        hiddenFields.get(domain)!.add(field)
      } else if (typeof value === 'string') {
        // Pre-load single option
        preloadOptions.push({ domain, field, option: value })
      } else if (Array.isArray(value)) {
        // Pre-load multiple options
        for (const opt of value) {
          if (typeof opt === 'string') {
            preloadOptions.push({ domain, field, option: opt })
          }
        }
      }
      // value === true → available, no action
    }
  }

  return { hiddenFields, preloadOptions }
}

// ── Flow parsing ──

export function parseFlow(flowDir: string): ParsedFlow | null {
  const indexPath = join(flowDir, 'index.md')
  if (!existsSync(indexPath)) return null

  const indexContent = readFileSync(indexPath, 'utf-8')
  const indexFm = parseSimpleFrontmatter(indexContent)

  // List step files matching N.Step Name.md
  const entries = readdirSync(flowDir).filter(f => /^\d+\./.test(f) && f.endsWith('.md'))
  entries.sort((a, b) => {
    const numA = parseInt(a.split('.')[0], 10)
    const numB = parseInt(b.split('.')[0], 10)
    return numA - numB
  })

  const steps: FlowStep[] = []

  for (const filename of entries) {
    const num = parseInt(filename.split('.')[0], 10)
    // Extract step name: "1.Define Meal Preferences.md" → "Define Meal Preferences"
    const name = filename.replace(/^\d+\./, '').replace(/\.md$/, '')
    const id = name.toLowerCase().replace(/\s+/g, '-')

    const content = readFileSync(join(flowDir, filename), 'utf-8')
    const fm = parseSimpleFrontmatter(content)

    // Extract body (after frontmatter, before <output> block)
    let body = content.replace(/^---\n[\s\S]*?\n---\n*/, '')
    let outputTarget: string | undefined
    let outputSchema: Record<string, any> | undefined

    // Parse <output target="variableName"> ... </output>
    const outputMatch = body.match(/<output\s+target="([^"]+)">([\s\S]*?)<\/output>/)
    if (outputMatch) {
      outputTarget = outputMatch[1]
      try {
        outputSchema = JSON.parse(outputMatch[2].trim())
      } catch { /* invalid JSON */ }
      body = body.replace(/<output[\s\S]*?<\/output>/, '').trim()
    }

    steps.push({
      number: num,
      name,
      id,
      description: fm.description ?? '',
      instructions: body.trim(),
      outputTarget,
      outputSchema,
    })
  }

  return {
    name: indexFm.name ?? 'Unnamed Flow',
    description: indexFm.description ?? '',
    steps,
  }
}

// ── Prompt formatting ──

export function formatActionsForPrompt(
  actions: Array<{ action: AgentAction; flow: ParsedFlow | null }>,
): string {
  const lines: string[] = []

  for (const { action, flow } of actions) {
    lines.push(`/${action.id} — ${action.label}`)
    if (action.description) lines.push(`  ${action.description}`)

    if (flow && flow.steps.length > 0) {
      const stepNames = flow.steps.map(s => s.name).join(' → ')
      lines.push(`  Steps: ${stepNames}`)
    }
  }

  return lines.join('\n')
}

export function generateTasklistCode(flow: ParsedFlow, tasklistId: string): string {
  const tasks = flow.steps.map((step, i) => {
    const task: Record<string, any> = {
      id: step.id,
      instructions: step.name,
    }
    if (step.outputSchema) {
      // The flow step's outputSchema is a full JSON Schema ({ type: "object", properties: {...} }).
      // The tasklist validator iterates outputSchema keys and checks each exists in the output,
      // so we need to use `properties` (the actual field definitions), not the wrapper.
      // Simplify to just key → { type } for the tasklist declaration.
      const props = step.outputSchema.properties ?? step.outputSchema
      const simple: Record<string, { type: string }> = {}
      for (const [key, val] of Object.entries(props)) {
        const v = val as any
        simple[key] = { type: v?.type ?? 'string' }
      }
      task.outputSchema = simple
    }
    if (i > 0) {
      task.dependsOn = [flow.steps[i - 1].id]
    }
    return task
  })

  const tasksJson = JSON.stringify(tasks, null, 2)
  return `tasklist("${tasklistId}", ${JSON.stringify(flow.description)}, ${tasksJson})`
}

// ── Utilities ──

function parseSimpleFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const result: Record<string, any> = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/)
    if (!m) continue
    const [, key, raw] = m
    let value: any = raw.trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (/^\d+$/.test(value)) value = parseInt(value, 10)
    if (/^\d+\.\d+$/.test(value)) value = parseFloat(value)
    result[key] = value
  }
  return result
}
