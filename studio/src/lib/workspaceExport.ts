/**
 * workspaceExport — NEW SPEC
 *
 * Serializes SpaceData back to the exact on-disk layout that the framework
 * loader (sdk/org/packages/core/src/spaces/*) reads and scaffoldSpace.ts writes:
 *
 *   agents/<slug>/instruct.md           — frontmatter + body
 *   tasklists/<name>/NN-<id>.md         — zero-padded task files
 *   knowledge/<domain>/<field>/index.md — type/variable/default + description
 *   knowledge/<domain>/<field>/<slug>.md — option content
 *   functions/<name>.ts                 — raw source
 *   components/view/<Name>.tsx          — raw source
 *   components/form/<Name>/web.tsx      — raw source
 *   components/form/<Name>/ink.tsx      — raw source
 */

import JSZip from 'jszip'
import type { Octokit } from '@octokit/rest'
import type {
  Agent,
  Task,
  Tasklist,
  KnowledgeDomain,
  KnowledgeField,
  SpaceData,
  ExtractedDataStructure,
  AgentAction,
} from '@/types/space-data'

export interface FileTreeFileNode {
  type: 'file'
  name: string
  content: string
}

export interface FileTreeDirectoryNode {
  type: 'directory'
  name: string
  children: FileTreeNode[]
}

export type FileTreeNode = FileTreeFileNode | FileTreeDirectoryNode

export interface ExportWorkspaceToGithubOptions {
  octokit: Octokit
  owner: string
  repoName: string
  privateRepo?: boolean
  description?: string
  commitMessage?: string
  onProgress?: (progress: {
    uploadedFiles: number
    totalFiles: number
    currentPath: string
  }) => void
}

export interface ExportWorkspaceToGithubResult {
  owner: string
  repoName: string
  repoUrl: string
  filesCreated: number
}

type GithubApiError = Error & {
  status?: number
  response?: { data?: { message?: string } }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

async function retryGitOperation<T>(operation: () => Promise<T>, attempts = 6): Promise<T> {
  let delayMs = 300
  let lastError: unknown

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const apiError = error as GithubApiError
      const isConflict = apiError?.status === 409
      const isLastAttempt = index === attempts - 1
      if (!isConflict || isLastAttempt) throw error
      await sleep(delayMs)
      delayMs = Math.min(delayMs * 2, 3000)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('GitHub operation failed')
}

// ── File-tree helpers ──────────────────────────────────────────────────────

function getOrCreateDirectory(parent: FileTreeDirectoryNode, name: string): FileTreeDirectoryNode {
  const existing = parent.children.find(
    (c): c is FileTreeDirectoryNode => c.type === 'directory' && c.name === name,
  )
  if (existing) return existing
  const next: FileTreeDirectoryNode = { type: 'directory', name, children: [] }
  parent.children.push(next)
  return next
}

function upsertFile(parent: FileTreeDirectoryNode, fileName: string, content: string) {
  const existingIndex = parent.children.findIndex(
    (c) => c.type === 'file' && c.name === fileName,
  )
  const node: FileTreeFileNode = { type: 'file', name: fileName, content }
  if (existingIndex >= 0) {
    parent.children[existingIndex] = node
  } else {
    parent.children.push(node)
  }
}

function addFileAtPath(root: FileTreeDirectoryNode, relativePath: string, content: string) {
  const segments = relativePath.split('/').filter(Boolean)
  if (segments.length === 0) return
  const fileName = segments[segments.length - 1]
  let cursor = root
  for (const segment of segments.slice(0, -1)) {
    cursor = getOrCreateDirectory(cursor, segment)
  }
  upsertFile(cursor, fileName, content)
}

function sortTree(node: FileTreeDirectoryNode) {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const child of node.children) {
    if (child.type === 'directory') sortTree(child)
  }
}

// ── Serializers ────────────────────────────────────────────────────────────

function serializeAgentInstruct(agent: Agent): string {
  const fm = agent.frontmatter
  const lines: string[] = ['---', `title: ${fm.title}`]

  if (fm.knowledge.length > 0) {
    lines.push('knowledge:')
    for (const k of fm.knowledge) lines.push(`  - ${k}`)
  } else {
    lines.push('knowledge: []')
  }

  if (fm.functions.length > 0) {
    lines.push('functions:')
    for (const f of fm.functions) lines.push(`  - ${f}`)
  } else {
    lines.push('functions: []')
  }

  if (fm.components.length > 0) {
    lines.push('components:')
    for (const c of fm.components) lines.push(`  - ${c}`)
  } else {
    lines.push('components: []')
  }

  if (fm.defaultAction) lines.push(`defaultAction: ${fm.defaultAction}`)

  if (fm.actions.length > 0) {
    lines.push('actions:')
    for (const a of fm.actions) {
      lines.push(`  - id: ${a.id}`)
      lines.push(`    label: "${a.label.replace(/"/g, '\\"')}"`)
      lines.push(`    description: "${a.description.replace(/"/g, '\\"')}"`)
      lines.push(`    tasklist: ${a.tasklist}`)
    }
  } else {
    lines.push('actions: []')
  }

  if (fm.dependencies.length > 0) {
    lines.push('dependencies:')
    for (const d of fm.dependencies) lines.push(`  - ${d}`)
  } else {
    lines.push('dependencies: []')
  }

  lines.push('---', '', (agent.body ?? '').trim())
  return lines.join('\n')
}

function serializeTask(task: Task): string {
  const lines: string[] = ['---', `id: ${task.id}`, 'output:']

  for (const [k, v] of Object.entries(task.output)) {
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

  if (task.condition !== undefined) {
    lines.push(`condition: "${task.condition.replace(/"/g, '\\"')}"`)
  }

  lines.push('---', '', (task.instruction ?? '').trim())
  return lines.join('\n')
}

function serializeKnowledgeFieldIndex(field: KnowledgeField): string {
  const idx = field.index
  const lines = ['---', `type: ${idx.type}`, `variable: ${idx.variable}`]
  if (idx.default !== undefined) lines.push(`default: ${idx.default}`)
  lines.push('---', '', (field.description ?? '').trim())
  return lines.join('\n')
}

function taskFilename(task: Task): string {
  return `${String(task.order).padStart(2, '0')}-${task.id}.md`
}

/**
 * Ensure exactly one task in the tasklist has goal: true.
 * If none is flagged, flag the last task (matching scaffoldSpace.ts behaviour).
 */
function ensureGoalTask(tasks: Task[]): Task[] {
  if (tasks.length === 0) return tasks
  const hasGoal = tasks.some((t) => t.goal)
  if (hasGoal) return tasks
  return tasks.map((t, i) => (i === tasks.length - 1 ? { ...t, goal: true } : t))
}

// ── Main export ────────────────────────────────────────────────────────────

export function workspaceToFileTreeJson(space: SpaceData): FileTreeDirectoryNode {
  const root: FileTreeDirectoryNode = { type: 'directory', name: space.id, children: [] }

  // package.json
  if (space.packageJson) {
    addFileAtPath(root, 'package.json', JSON.stringify(space.packageJson, null, 2))
  }

  // .env files
  const envEntries = Object.entries(space.env || {}).sort(([a], [b]) => a.localeCompare(b))
  for (const [fileName, encryptedEnv] of envEntries) {
    if (!fileName.startsWith('.env')) continue
    addFileAtPath(root, fileName, JSON.stringify(encryptedEnv, null, 2))
  }

  // agents/<slug>/instruct.md
  const sortedAgents = Object.values(space.agents || {}).sort((a, b) => a.id.localeCompare(b.id))
  for (const agent of sortedAgents) {
    addFileAtPath(root, `agents/${agent.id}/instruct.md`, serializeAgentInstruct(agent))

    for (const conversation of agent.conversations || []) {
      const convId = (conversation.id || `conversation-${Date.now()}`).replace(/\//g, '-')
      addFileAtPath(
        root,
        `agents/${agent.id}/conversations/${convId}.json`,
        JSON.stringify(conversation, null, 2),
      )
    }
  }

  // tasklists/<name>/NN-<id>.md
  const sortedTasklists = Object.values(space.tasklists || {}).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  for (const tasklist of sortedTasklists) {
    const tasks = ensureGoalTask([...(tasklist.tasks || [])].sort((a, b) => a.order - b.order))
    for (const task of tasks) {
      addFileAtPath(root, `tasklists/${tasklist.name}/${taskFilename(task)}`, serializeTask(task))
    }
  }

  // knowledge/<domain>/<field>/index.md + options
  const sortedDomains = Object.values(space.knowledge || {}).sort((a, b) =>
    a.slug.localeCompare(b.slug),
  )
  for (const domain of sortedDomains) {
    const sortedFields = Object.values(domain.fields || {}).sort((a, b) =>
      a.slug.localeCompare(b.slug),
    )
    for (const field of sortedFields) {
      addFileAtPath(
        root,
        `knowledge/${domain.slug}/${field.slug}/index.md`,
        serializeKnowledgeFieldIndex(field),
      )
      for (const [slug, content] of Object.entries(field.options || {})) {
        addFileAtPath(root, `knowledge/${domain.slug}/${field.slug}/${slug}.md`, content)
      }
    }
  }

  // functions/<name>.ts
  const sortedFunctions = Object.values(space.functions || {}).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  for (const fn of sortedFunctions) {
    addFileAtPath(root, `functions/${fn.name}.ts`, fn.source)
  }

  // components/view/<Name>.tsx
  const sortedViews = Object.values(space.components?.view || {}).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  for (const view of sortedViews) {
    addFileAtPath(root, `components/view/${view.name}.tsx`, view.source)
  }

  // components/form/<Name>/{web,ink}.tsx
  const sortedForms = Object.values(space.components?.form || {}).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  for (const form of sortedForms) {
    addFileAtPath(root, `components/form/${form.name}/web.tsx`, form.web)
    addFileAtPath(root, `components/form/${form.name}/ink.tsx`, form.ink)
  }

  sortTree(root)
  return root
}

function addFileTreeNodeToZip(zip: JSZip, node: FileTreeNode, basePath = '') {
  const nodePath = basePath ? `${basePath}/${node.name}` : node.name
  if (node.type === 'file') {
    zip.file(nodePath, node.content)
    return
  }
  for (const child of node.children) {
    addFileTreeNodeToZip(zip, child, nodePath)
  }
}

function fileTreeToFileEntries(
  fileTree: FileTreeDirectoryNode,
): Array<{ path: string; content: string }> {
  const entries: Array<{ path: string; content: string }> = []
  const visit = (node: FileTreeNode, basePath = '') => {
    const nodePath = basePath ? `${basePath}/${node.name}` : node.name
    if (node.type === 'file') {
      entries.push({ path: nodePath, content: node.content })
      return
    }
    for (const child of node.children) visit(child, nodePath)
  }
  for (const child of fileTree.children) visit(child)
  return entries
}

export async function fileTreeJsonToZipBlob(fileTree: FileTreeDirectoryNode): Promise<Blob> {
  const zip = new JSZip()
  addFileTreeNodeToZip(zip, fileTree)
  return zip.generateAsync({ type: 'blob' })
}

export async function downloadWorkspaceZip(space: SpaceData): Promise<void> {
  const fileTree = workspaceToFileTreeJson(space)
  const blob = await fileTreeJsonToZipBlob(fileTree)
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = `${space.id}-space.zip`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function downloadAllWorkspacesZip(data: ExtractedDataStructure): Promise<void> {
  const root: FileTreeDirectoryNode = {
    type: 'directory',
    name: 'spaces',
    children: Object.values(data.spaces || {}).map(workspaceToFileTreeJson),
  }
  const blob = await fileTreeJsonToZipBlob(root)
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = 'spaces-file-tree.zip'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function exportWorkspaceToNewGithubRepo(
  space: SpaceData,
  options: ExportWorkspaceToGithubOptions,
): Promise<ExportWorkspaceToGithubResult> {
  const { octokit, owner, repoName, privateRepo = true, description, commitMessage, onProgress } =
    options

  const fileTree = workspaceToFileTreeJson(space)
  const originalEntries = fileTreeToFileEntries(fileTree)
  const fileEntries =
    originalEntries.length > 0
      ? originalEntries
      : [
          {
            path: 'README.md',
            content: `# ${repoName}\n\nExported from LMThing space \`${space.id}\`.`,
          },
        ]
  const totalFiles = fileEntries.length

  onProgress?.({ uploadedFiles: 0, totalFiles, currentPath: 'Creating repository…' })

  const { data: createdRepo } = await octokit.rest.repos.createForAuthenticatedUser({
    name: repoName,
    description: description || `Exported space "${space.id}" from LMThing`,
    private: privateRepo,
    auto_init: true,
  })

  const defaultBranch = createdRepo.default_branch || 'main'

  const treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; content: string }> = []
  let uploadedFiles = 0

  for (const entry of fileEntries) {
    onProgress?.({ uploadedFiles, totalFiles, currentPath: entry.path })
    treeItems.push({ path: entry.path, mode: '100644', type: 'blob', content: entry.content })
    uploadedFiles += 1
    onProgress?.({ uploadedFiles, totalFiles, currentPath: entry.path })
  }

  onProgress?.({ uploadedFiles, totalFiles, currentPath: 'Creating commit…' })

  const { data: tree } = await retryGitOperation(() =>
    octokit.rest.git.createTree({ owner, repo: repoName, tree: treeItems }),
  )

  const { data: commit } = await retryGitOperation(() =>
    octokit.rest.git.createCommit({
      owner,
      repo: repoName,
      message: commitMessage?.trim() || `Export space "${space.id}"`,
      tree: tree.sha,
      parents: [],
    }),
  )

  await retryGitOperation(() =>
    octokit.rest.git.updateRef({
      owner,
      repo: repoName,
      ref: `heads/${defaultBranch}`,
      sha: commit.sha,
      force: true,
    }),
  )

  return { owner, repoName, repoUrl: `https://github.com/${owner}/${repoName}`, filesCreated: uploadedFiles }
}
