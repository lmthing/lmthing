/**
 * Converts a demo workspace JSON into a flat FileTree (Record<string, string>)
 * suitable for importStudio.
 *
 * NEW SPEC output layout:
 *   {spaceId}/agents/<slug>/instruct.md
 *   {spaceId}/tasklists/<name>/NN-<id>.md
 *   {spaceId}/knowledge/<domain>/<field>/index.md
 *   {spaceId}/knowledge/<domain>/<field>/<optionSlug>.md
 *   {spaceId}/package.json
 *
 * All paths are prefixed with `{spaceId}/` so they sit inside a studio.
 */

// ============================================================
// NEW-SPEC input shape (what demo JSON files should provide)
// ============================================================

export interface DemoAgentAction {
  id: string
  label: string
  description: string
  tasklist: string
}

export interface DemoAgent {
  id: string
  title: string
  knowledge?: string[]
  functions?: string[]
  components?: string[]
  actions?: DemoAgentAction[]
  defaultAction?: string
  dependencies?: string[]
  body?: string
}

export interface DemoTasklistTask {
  id: string
  instruction: string
  output?: Record<string, string>
  dependsOn?: string[]
  optional?: boolean
  goal?: boolean
}

export interface DemoTasklist {
  name: string
  tasks: DemoTasklistTask[]
}

export interface DemoKnowledgeOption {
  slug: string
  content: string
}

export interface DemoKnowledgeField {
  slug: string
  type?: string
  variable: string
  default?: string
  description?: string
  options?: DemoKnowledgeOption[]
}

export interface DemoKnowledgeDomain {
  slug: string
  fields: DemoKnowledgeField[]
}

export interface DemoWorkspaceData {
  id: string
  agents?: Record<string, DemoAgent>
  tasklists?: Record<string, DemoTasklist>
  knowledge?: DemoKnowledgeDomain[]
  packageJson?: Record<string, unknown> | null
  env?: Record<string, unknown>
}

// ============================================================
// Helpers
// ============================================================

function serializeInstruct(agent: DemoAgent): string {
  const lines: string[] = ['---', `title: ${agent.title}`]

  const knowledge = agent.knowledge ?? []
  if (knowledge.length > 0) {
    lines.push('knowledge:')
    for (const k of knowledge) lines.push(`  - ${k}`)
  } else {
    lines.push('knowledge: []')
  }

  const functions_ = agent.functions ?? []
  if (functions_.length > 0) {
    lines.push('functions:')
    for (const f of functions_) lines.push(`  - ${f}`)
  } else {
    lines.push('functions: []')
  }

  const components = agent.components ?? []
  if (components.length > 0) {
    lines.push('components:')
    for (const c of components) lines.push(`  - ${c}`)
  } else {
    lines.push('components: []')
  }

  if (agent.defaultAction) {
    lines.push(`defaultAction: ${agent.defaultAction}`)
  }

  const actions = agent.actions ?? []
  if (actions.length > 0) {
    lines.push('actions:')
    for (const a of actions) {
      lines.push(`  - id: ${a.id}`)
      lines.push(`    label: "${(a.label ?? '').replace(/"/g, '\\"')}"`)
      lines.push(`    description: "${(a.description ?? '').replace(/"/g, '\\"')}"`)
      lines.push(`    tasklist: ${a.tasklist}`)
    }
  } else {
    lines.push('actions: []')
  }

  const deps = agent.dependencies ?? []
  if (deps.length > 0) {
    lines.push('dependencies:')
    for (const d of deps) lines.push(`  - ${d}`)
  } else {
    lines.push('dependencies: []')
  }

  lines.push('---')
  lines.push('')
  lines.push((agent.body ?? '').trim())

  return lines.join('\n')
}

function serializeTask(order: number, task: DemoTasklistTask): string {
  const output = task.output ?? { result: 'string' }
  const lines: string[] = ['---', `id: ${task.id}`, 'output:']
  for (const [k, v] of Object.entries(output)) {
    lines.push(`  ${k}: ${v}`)
  }

  const dependsOn = task.dependsOn ?? []
  if (dependsOn.length > 0) {
    lines.push('dependsOn:')
    for (const d of dependsOn) lines.push(`  - ${d}`)
  } else {
    lines.push('dependsOn: []')
  }

  lines.push(`optional: ${task.optional ?? false}`)
  lines.push(`goal: ${task.goal ?? false}`)
  lines.push('---')
  lines.push('')
  lines.push(task.instruction.trim())

  return lines.join('\n')
}

function taskFilename(order: number, id: string): string {
  return `${String(order).padStart(2, '0')}-${id}.md`
}

function serializeKnowledgeFieldIndex(field: DemoKnowledgeField): string {
  const lines: string[] = ['---', `type: ${field.type ?? 'string'}`, `variable: ${field.variable}`]
  if (field.default !== undefined) lines.push(`default: "${field.default}"`)
  lines.push('---')
  lines.push('')
  lines.push((field.description ?? `${field.variable} field.`).trim())
  return lines.join('\n')
}

// ============================================================
// Main converter
// ============================================================

export function demoToFileTree(data: DemoWorkspaceData): Record<string, string> {
  const spaceId = data.id
  const prefix = `${spaceId}/`
  const files: Record<string, string> = {}

  // package.json
  if (data.packageJson) {
    files[`${prefix}package.json`] = JSON.stringify(data.packageJson, null, 2)
  }

  // env files (keep as-is — still JSON blobs)
  for (const [name, content] of Object.entries(data.env ?? {})) {
    if (name.startsWith('.env')) {
      files[`${prefix}${name}`] = JSON.stringify(content, null, 2)
    }
  }

  // agents → agents/<id>/instruct.md (new spec)
  for (const agent of Object.values(data.agents ?? {})) {
    files[`${prefix}agents/${agent.id}/instruct.md`] = serializeInstruct(agent)
  }

  // tasklists → tasklists/<name>/NN-<id>.md (new spec)
  for (const tasklist of Object.values(data.tasklists ?? {})) {
    let order = 1
    for (const task of tasklist.tasks) {
      const filename = taskFilename(order, task.id)
      files[`${prefix}tasklists/${tasklist.name}/${filename}`] = serializeTask(order, task)
      order++
    }
  }

  // knowledge → knowledge/<domain>/<field>/index.md + <slug>.md options (new spec)
  for (const domain of data.knowledge ?? []) {
    for (const field of domain.fields) {
      const base = `${prefix}knowledge/${domain.slug}/${field.slug}`
      files[`${base}/index.md`] = serializeKnowledgeFieldIndex(field)
      for (const option of field.options ?? []) {
        files[`${base}/${option.slug}.md`] = option.content
      }
    }
  }

  return files
}
