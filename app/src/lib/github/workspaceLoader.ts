import type { Octokit } from '@octokit/rest'
import type {
  Agent,
  AgentConfig,
  AgentFrontmatter,
  AgentSlashAction,
  Conversation,
  Flow,
  FlowFrontmatter,
  FlowTask,
  KnowledgeNode,
  PackageJson,
  TaskFrontmatter,
  WorkspaceData,
} from '@/types/workspace-data'

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

const OUTPUT_TAG_REGEX = /<output(?:\s+target="([^"]+)")?>\n([\s\S]*?)\n<\/output>/

function decodeBase64Utf8(base64: string): string {
  const normalized = base64.replace(/\n/g, '')
  const binary = atob(normalized)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function parseFrontmatter<T = Record<string, unknown>>(content: string): {
  frontmatter: T
  body: string
} {
  const match = content.match(FRONTMATTER_REGEX)
  if (!match) {
    return { frontmatter: {} as T, body: content }
  }

  const frontmatterLines = match[1].split('\n')
  const frontmatter: Record<string, unknown> = {}

  for (const line of frontmatterLines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()

    if (typeof value === 'string') {
      let stringValue = value

      if (
        (stringValue.startsWith('"') && stringValue.endsWith('"')) ||
        (stringValue.startsWith("'") && stringValue.endsWith("'"))
      ) {
        stringValue = stringValue.slice(1, -1)
      }

      if (stringValue.startsWith('[') || stringValue.startsWith('{')) {
        try {
          value = JSON.parse(stringValue)
        } catch {
          value = stringValue
        }
      } else {
        value = stringValue
      }
    }

    frontmatter[key] = value
  }

  return { frontmatter: frontmatter as T, body: match[2].trim() }
}

function parseSlashActions(content: string): AgentSlashAction[] {
  const slashActionRegex =
    /<slash_action\s+name="([^"]+)"\s+description="([^"]+)"\s+flowId="([^"]+)">\s*\/([^\s\n]+)\s*<\/slash_action>/g

  const actions: AgentSlashAction[] = []
  let match: RegExpExecArray | null = null

  while ((match = slashActionRegex.exec(content)) !== null) {
    actions.push({
      name: match[1],
      description: match[2],
      flowId: match[3],
      actionId: match[4].trim(),
    })
  }

  return actions
}

function stripSlashActions(content: string): string {
  const slashActionRegex =
    /<slash_action\s+name="([^"]+)"\s+description="([^"]+)"\s+flowId="([^"]+)">\s*\/([^\s\n]+)\s*<\/slash_action>/g
  return content.replace(slashActionRegex, '').trim()
}

function parseOutputTag(content: string): { outputSchema?: FlowTask['outputSchema']; targetFieldName?: string } {
  const match = content.match(OUTPUT_TAG_REGEX)
  if (!match) return {}

  try {
    const outputSchema = JSON.parse(match[2]) as FlowTask['outputSchema']
    return {
      outputSchema,
      targetFieldName: match[1] || undefined,
    }
  } catch {
    return {}
  }
}

function stripOutputTag(content: string): string {
  return content.replace(OUTPUT_TAG_REGEX, '').trim()
}

function sortKnowledgeNodes(nodes: KnowledgeNode[]): KnowledgeNode[] {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.path.localeCompare(b.path)
  })

  return sorted.map((node) => {
    if (node.type === 'directory' && node.children) {
      return {
        ...node,
        children: sortKnowledgeNodes(node.children),
      }
    }
    return node
  })
}

function buildKnowledgeTree(
  markdownFiles: Array<{ relativePath: string; content: string }>,
  configFiles: Array<{ relativePath: string; content: string }>
): KnowledgeNode[] {
  const rootNodes: KnowledgeNode[] = []
  const directoryMap = new Map<string, KnowledgeNode>()

  const getParentPath = (value: string): string => {
    const parts = value.split('/').filter(Boolean)
    if (parts.length <= 1) return ''
    return parts.slice(0, -1).join('/')
  }

  const ensureDirectory = (directoryPath: string): KnowledgeNode => {
    const normalizedPath = directoryPath.replace(/^\/+|\/+$/g, '')
    const existing = directoryMap.get(normalizedPath)
    if (existing) return existing

    const node: KnowledgeNode = {
      path: normalizedPath,
      type: 'directory',
      children: [],
    }

    directoryMap.set(normalizedPath, node)

    const parentPath = getParentPath(normalizedPath)
    if (!parentPath) {
      rootNodes.push(node)
    } else {
      const parentNode = ensureDirectory(parentPath)
      parentNode.children = [...(parentNode.children || []), node]
    }

    return node
  }

  for (const file of markdownFiles) {
    const parentPath = getParentPath(file.relativePath)
    const { frontmatter, body } = parseFrontmatter(file.content)

    const fileNode: KnowledgeNode = {
      path: file.relativePath,
      type: 'file',
      frontmatter,
      content: body,
    }

    if (!parentPath) {
      rootNodes.push(fileNode)
    } else {
      const parentNode = ensureDirectory(parentPath)
      parentNode.children = [...(parentNode.children || []), fileNode]
    }
  }

  for (const configFile of configFiles) {
    const directoryPath = configFile.relativePath.replace(/\/config\.json$/, '')
    if (!directoryPath) continue

    const directoryNode = ensureDirectory(directoryPath)
    try {
      directoryNode.config = JSON.parse(configFile.content)
    } catch {
      directoryNode.config = {}
    }
  }

  return sortKnowledgeNodes(rootNodes)
}

type RepoTextFile = {
  path: string
  content: string
}

export interface GithubWorkspaceLoadProgress {
  loadedFiles: number
  totalFiles: number
  currentPath: string
}

async function listRepoTextFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  onProgress?: (progress: GithubWorkspaceLoadProgress) => void
): Promise<RepoTextFile[]> {
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo })
  const defaultBranch = repoData.default_branch || 'main'

  const { data: branch } = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch: defaultBranch,
  })

  const treeSha = branch.commit.commit.tree.sha

  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: '1',
  })

  const fileEntries = tree.tree
    .filter((entry) => entry.type === 'blob' && Boolean(entry.path) && Boolean(entry.sha))
    .map((entry) => ({
      path: entry.path as string,
      sha: entry.sha as string,
    }))

  const relevantEntries = fileEntries.filter((entry) =>
    entry.path === 'package.json' ||
    entry.path.startsWith('agents/') ||
    entry.path.startsWith('flows/') ||
    entry.path.startsWith('knowledge/')
  )

  const files: RepoTextFile[] = []
  const totalFiles = relevantEntries.length
  let loadedFiles = 0

  onProgress?.({
    loadedFiles,
    totalFiles,
    currentPath: 'Reading repository tree…',
  })

  for (const entry of relevantEntries) {
    onProgress?.({
      loadedFiles,
      totalFiles,
      currentPath: entry.path,
    })

    const { data: blob } = await octokit.rest.git.getBlob({
      owner,
      repo,
      file_sha: entry.sha,
    })

    const content = decodeBase64Utf8(blob.content)
    files.push({ path: entry.path, content })

    loadedFiles += 1
    onProgress?.({
      loadedFiles,
      totalFiles,
      currentPath: entry.path,
    })
  }

  return files
}

export async function loadWorkspaceDataFromGithubRepo(params: {
  octokit: Octokit
  owner: string
  repo: string
  workspaceId: string
  onProgress?: (progress: GithubWorkspaceLoadProgress) => void
}): Promise<WorkspaceData> {
  const { octokit, owner, repo, workspaceId, onProgress } = params
  const files = await listRepoTextFiles(octokit, owner, repo, onProgress)

  const agents: Record<string, Agent> = {}
  const flows: Record<string, Flow> = {}
  const knowledgeMarkdown: Array<{ relativePath: string; content: string }> = []
  const knowledgeConfigs: Array<{ relativePath: string; content: string }> = []
  let packageJson: PackageJson | null = null

  for (const file of files) {
    if (file.path === 'package.json') {
      try {
        packageJson = JSON.parse(file.content) as PackageJson
      } catch {
        packageJson = null
      }
      continue
    }

    const agentMatch = file.path.match(/^agents\/([^/]+)\/(.+)$/)
    if (agentMatch) {
      const agentId = agentMatch[1]
      const relative = agentMatch[2]

      if (!agents[agentId]) {
        agents[agentId] = {
          id: agentId,
          frontmatter: {} as AgentFrontmatter,
          mainInstruction: '',
          slashActions: [],
          config: { emptyFieldsForRuntime: [] } as AgentConfig,
          formValues: {},
          conversations: [],
        }
      }

      if (relative === 'instruct.md') {
        const { frontmatter, body } = parseFrontmatter<AgentFrontmatter>(file.content)
        agents[agentId].frontmatter = frontmatter
        agents[agentId].slashActions = parseSlashActions(body)
        agents[agentId].mainInstruction = stripSlashActions(body)
      } else if (relative === 'config.json') {
        try {
          agents[agentId].config = JSON.parse(file.content) as AgentConfig
        } catch {
          agents[agentId].config = { emptyFieldsForRuntime: [] }
        }
      } else if (relative === 'values.json') {
        try {
          agents[agentId].formValues = JSON.parse(file.content) as Agent['formValues']
        } catch {
          agents[agentId].formValues = {}
        }
      } else if (relative.startsWith('conversations/') && relative.endsWith('.json')) {
        try {
          const conversation = JSON.parse(file.content) as Conversation
          agents[agentId].conversations.push(conversation)
        } catch {
          // Ignore malformed conversation files
        }
      }

      continue
    }

    const flowMatch = file.path.match(/^flows\/([^/]+)\/(.+)$/)
    if (flowMatch) {
      const flowId = flowMatch[1]
      const relative = flowMatch[2]

      if (!flows[flowId]) {
        flows[flowId] = {
          id: flowId,
          frontmatter: {} as FlowFrontmatter,
          description: '',
          tasks: [],
        }
      }

      if (relative === 'index.md') {
        const { frontmatter, body } = parseFrontmatter<FlowFrontmatter>(file.content)
        flows[flowId].frontmatter = frontmatter
        flows[flowId].description = body
      } else if (relative.endsWith('.md')) {
        const taskFileName = relative.replace(/\.md$/, '')
        const taskMatch = taskFileName.match(/^(\d+)\.(.+)$/)
        if (taskMatch) {
          const order = parseInt(taskMatch[1], 10)
          const name = taskMatch[2]
          const { frontmatter, body } = parseFrontmatter<TaskFrontmatter>(file.content)
          const { outputSchema, targetFieldName } = parseOutputTag(body)

          flows[flowId].tasks.push({
            order,
            name,
            frontmatter,
            instructions: stripOutputTag(body),
            outputSchema,
            targetFieldName,
          })
        }
      }

      continue
    }

    const knowledgeMatch = file.path.match(/^knowledge\/(.+)$/)
    if (knowledgeMatch) {
      const relativePath = knowledgeMatch[1]
      if (relativePath.endsWith('.md')) {
        knowledgeMarkdown.push({ relativePath, content: file.content })
      } else if (relativePath.endsWith('/config.json')) {
        knowledgeConfigs.push({ relativePath, content: file.content })
      }
    }
  }

  Object.values(flows).forEach((flow) => {
    flow.tasks.sort((a, b) => a.order - b.order)
  })

  Object.values(agents).forEach((agent) => {
    agent.conversations.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return bTime - aTime
    })
  })

  const knowledge = buildKnowledgeTree(knowledgeMarkdown, knowledgeConfigs)

  const fallbackPackageJson: PackageJson = {
    name: repo,
    version: '1.0.0',
    description: '',
    dependencies: {},
  }

  return {
    id: workspaceId,
    agents,
    flows,
    knowledge,
    packageJson: packageJson || fallbackPackageJson,
  }
}
