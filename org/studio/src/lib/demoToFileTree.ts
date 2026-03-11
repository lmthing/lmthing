/**
 * Converts a demo workspace JSON (WorkspaceData shape from /demos/*.json)
 * into a flat FileTree (Record<string, string>) suitable for importStudio.
 *
 * All paths are prefixed with `{spaceId}/` so they sit inside a studio.
 */

interface AgentSlashAction {
  name: string
  description: string
  flowId: string
  actionId: string
}

interface AgentData {
  id: string
  frontmatter: Record<string, unknown>
  mainInstruction: string
  slashActions: AgentSlashAction[]
  config: Record<string, unknown>
  formValues: Record<string, unknown>
  conversations: unknown[]
}

interface FlowTask {
  order: number
  name: string
  frontmatter: Record<string, unknown>
  instructions: string
}

interface FlowData {
  id: string
  frontmatter: Record<string, unknown>
  description: string
  tasks: FlowTask[]
}

interface KnowledgeNode {
  path: string
  type: 'file' | 'directory'
  children?: KnowledgeNode[]
  config?: Record<string, unknown>
  frontmatter?: Record<string, unknown>
  content?: string
}

export interface DemoWorkspaceData {
  id: string
  agents: Record<string, AgentData>
  flows: Record<string, FlowData>
  knowledge: KnowledgeNode[]
  packageJson: Record<string, unknown> | null
  env: Record<string, unknown>
}

function frontmatterValue(value: unknown): string {
  if (value === undefined) return ''
  if (value === null) return 'null'
  return JSON.stringify(value)
}

function formatMarkdown(frontmatter: Record<string, unknown> | undefined, body: string): string {
  const fm = frontmatter || {}
  const keys = Object.keys(fm).filter(k => fm[k] !== undefined)
  if (keys.length === 0) return body.trim()
  const fmText = keys.map(k => `${k}: ${frontmatterValue(fm[k])}`).join('\n')
  return `---\n${fmText}\n---\n${body.trim()}`
}

function escapeAttr(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function toSlashActionBlock(actions: AgentSlashAction[]): string {
  if (!actions.length) return ''
  return actions
    .map(a => `<slash_action name="${escapeAttr(a.name)}" description="${escapeAttr(a.description)}" flowId="${escapeAttr(a.flowId)}">\n/${a.actionId.replace(/^\/+/, '')}\n</slash_action>`)
    .join('\n\n')
}

function walkKnowledge(nodes: KnowledgeNode[], files: Record<string, string>, prefix: string) {
  for (const node of nodes) {
    if (node.type === 'directory') {
      if (node.config && Object.keys(node.config).length > 0) {
        files[`${prefix}knowledge/${node.path}/config.json`] = JSON.stringify(node.config, null, 2)
      }
      if (node.children) walkKnowledge(node.children, files, prefix)
    } else {
      files[`${prefix}knowledge/${node.path}`] = formatMarkdown(node.frontmatter, node.content || '')
    }
  }
}

export function demoToFileTree(data: DemoWorkspaceData): Record<string, string> {
  const spaceId = data.id
  const prefix = `${spaceId}/`
  const files: Record<string, string> = {}

  // package.json
  if (data.packageJson) {
    files[`${prefix}package.json`] = JSON.stringify(data.packageJson, null, 2)
  }

  // env files
  for (const [name, content] of Object.entries(data.env || {})) {
    if (name.startsWith('.env')) {
      files[`${prefix}${name}`] = JSON.stringify(content, null, 2)
    }
  }

  // agents
  for (const agent of Object.values(data.agents || {})) {
    const base = `${prefix}agents/${agent.id}`
    const body = [agent.mainInstruction?.trim() || '', toSlashActionBlock(agent.slashActions || [])].filter(Boolean).join('\n\n')
    files[`${base}/instruct.md`] = formatMarkdown(agent.frontmatter, body)
    files[`${base}/config.json`] = JSON.stringify(agent.config || {}, null, 2)
    files[`${base}/values.json`] = JSON.stringify(agent.formValues || {}, null, 2)
  }

  // flows
  for (const flow of Object.values(data.flows || {})) {
    const base = `${prefix}flows/${flow.id}`
    files[`${base}/index.md`] = formatMarkdown(flow.frontmatter, flow.description || '')
    for (const task of flow.tasks || []) {
      const taskName = (task.name || 'task').replaceAll('/', '-')
      files[`${base}/${task.order}.${taskName}.md`] = formatMarkdown(task.frontmatter, task.instructions || '')
    }
  }

  // knowledge
  walkKnowledge(data.knowledge || [], files, prefix)

  return files
}
