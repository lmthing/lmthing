import type {
  Agent,
  AgentFrontmatter,
  AgentSlashAction,
  Flow,
  FlowTask,
  TaskFrontmatter,
  FlowFrontmatter,
  KnowledgeNode,
  WorkspaceData,
  ExtractedDataStructure,
  Conversation,
  AgentConfig,
  FormValues,
  TaskOutputSchema,
} from '@/types/workspace-data'

// ============================================================================
// Frontmatter Parser
// ============================================================================

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

export function parseFrontmatter<T = Record<string, unknown>>(
  content: string
): { frontmatter: T; body: string } {
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

    // Remove quotes if present
    if (typeof value === 'string') {
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      // Try to parse as JSON for arrays and objects
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        try {
          value = JSON.parse(value as string)
        } catch {
          // Keep as string if parsing fails
        }
      }
    }

    frontmatter[key] = value
  }

  return { frontmatter: frontmatter as T, body: match[2].trim() }
}

// ============================================================================
// Slash Action Parser
// ============================================================================

const SLASH_ACTION_REGEX =
  /<slash_action\s+name="([^"]+)"\s+description="([^"]+)"\s+flowId="([^"]+)">\s*\/([^\s\n]+)\s*<\/slash_action>/g

export function parseSlashActions(content: string): AgentSlashAction[] {
  const actions: AgentSlashAction[] = []
  let match

  while ((match = SLASH_ACTION_REGEX.exec(content)) !== null) {
    actions.push({
      name: match[1],
      description: match[2],
      flowId: match[3],
      actionId: match[4].trim(),
    })
  }

  return actions
}

// ============================================================================
// Output Tag Parser
// ============================================================================

const OUTPUT_TAG_REGEX =
  /<output(?:\s+target="([^"]+)")?>\n([\s\S]*?)\n<\/output>/

export function parseOutputTag(content: string): {
  outputSchema?: TaskOutputSchema
  targetFieldName?: string
} {
  const match = content.match(OUTPUT_TAG_REGEX)
  if (!match) return {}

  try {
    const outputSchema = JSON.parse(match[2]) as TaskOutputSchema
    return {
      outputSchema,
      targetFieldName: match[1] || undefined,
    }
  } catch {
    return {}
  }
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extracts workspace data from an import.meta.glob result
 * @param workspaceId The workspace identifier
 * @param globResult Result from import.meta.glob with { eager: true, as: 'raw' }
 *        Example: { 'agents/agent1/instruct.md': 'content...', 'package.json': '...' }
 */
export function extractWorkspaceData(
  workspaceId: string,
  globResult: Record<string, string>
): WorkspaceData {
  const result: WorkspaceData = {
    id: workspaceId,
    agents: {},
    flows: {},
    knowledge: [],
    packageJson: null,
    env: {},
  }

  // Read package.json if it exists
  const packageJsonContent = globResult['package.json']
  if (packageJsonContent) {
    try {
      result.packageJson = JSON.parse(packageJsonContent) as WorkspaceData['packageJson']
    } catch {
      // Invalid JSON - keep as null
    }
  }

  // Extract agents
  const agentIds = new Set<string>()
  for (const filePath of Object.keys(globResult)) {
    const match = filePath.match(/^agents\/([^/]+)\//)
    if (match) agentIds.add(match[1])
  }

  for (const agentId of agentIds) {
    const agent: Agent = {
      id: agentId,
      frontmatter: {},
      mainInstruction: '',
      slashActions: [],
      config: { emptyFieldsForRuntime: [] },
      formValues: {},
      conversations: [],
    }

    // Read instruct.md
    const instructContent = globResult[`agents/${agentId}/instruct.md`]
    if (instructContent) {
      const { frontmatter, body } =
        parseFrontmatter<AgentFrontmatter>(instructContent)
      agent.frontmatter = frontmatter
      agent.slashActions = parseSlashActions(body)
      agent.mainInstruction = body.replace(SLASH_ACTION_REGEX, '').trim()
    }

    // Read config.json
    const configContent = globResult[`agents/${agentId}/config.json`]
    if (configContent) {
      try {
        agent.config = JSON.parse(configContent) as AgentConfig
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn(`Invalid config.json for agent ${agentId}: ${message}`)
      }
    }

    // Read values.json
    const valuesContent = globResult[`agents/${agentId}/values.json`]
    if (valuesContent) {
      try {
        agent.formValues = JSON.parse(valuesContent) as FormValues
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn(`Invalid values.json for agent ${agentId}: ${message}`)
      }
    }

    // Read conversations
    for (const filePath of Object.keys(globResult)) {
      const convMatch = filePath.match(/^agents\/([^/]+)\/conversations\/(.+\.json)$/)
      if (convMatch && convMatch[1] === agentId) {
        try {
          const conversation = JSON.parse(globResult[filePath]) as Conversation
          agent.conversations.push(conversation)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          console.warn(`Invalid conversation file ${filePath}: ${message}`)
        }
      }
    }

    result.agents[agentId] = agent
  }

  // Extract flows
  const flowIds = new Set<string>()
  for (const filePath of Object.keys(globResult)) {
    const match = filePath.match(/^flows\/([^/]+)\//)
    if (match) flowIds.add(match[1])
  }

  for (const flowId of flowIds) {
    const flow: Flow = {
      id: flowId,
      frontmatter: {} as FlowFrontmatter,
      description: '',
      tasks: [],
    }

    // Read index.md
    const indexContent = globResult[`flows/${flowId}/index.md`]
    if (indexContent) {
      const { frontmatter, body } =
        parseFrontmatter<FlowFrontmatter>(indexContent)
      flow.frontmatter = frontmatter
      flow.description = body
    }

    // Read task files
    for (const filePath of Object.keys(globResult)) {
      const taskMatch = filePath.match(/^flows\/([^/]+)\/([^/]+\.md)$/)
      if (taskMatch && taskMatch[1] === flowId && taskMatch[2] !== 'index.md') {
        const taskFile = taskMatch[2]
        const taskContent = globResult[filePath]
        const { frontmatter, body } =
          parseFrontmatter<TaskFrontmatter>(taskContent)

        // Extract order and name from filename: {order}.{name}.md
        const parts = taskFile.replace('.md', '').split('.')
        const order = parseInt(parts[0], 10)
        const name = parts.slice(1).join('.')

        // Parse output tag if present
        const { outputSchema, targetFieldName } = parseOutputTag(body)

        // Remove output tag from instructions
        const instructions = body.replace(OUTPUT_TAG_REGEX, '').trim()

        const task: FlowTask = {
          order,
          name,
          frontmatter,
          instructions,
          outputSchema,
          targetFieldName,
        }

        flow.tasks.push(task)
      }
    }

    // Sort tasks by order
    flow.tasks.sort((a, b) => a.order - b.order)

    result.flows[flowId] = flow
  }

  // Extract knowledge
  const knowledgeFiles = Object.keys(globResult)
    .filter((p) => p.startsWith('knowledge/'))
    .sort()

  function buildKnowledgeTree(files: string[]): KnowledgeNode[] {
    const tree: KnowledgeNode[] = []
    const dirMap = new Map<string, KnowledgeNode>()

    for (const filePath of files) {
      const relativePath = filePath.replace(/^knowledge\//, '')
      const parts = relativePath.split('/')

      // Build directory structure
      let currentPath = ''
      for (let i = 0; i < parts.length - 1; i++) {
        const dirName = parts[i]
        const parentPath = currentPath
        currentPath = currentPath ? `${currentPath}/${dirName}` : dirName

        if (!dirMap.has(currentPath)) {
          const dirNode: KnowledgeNode = {
            path: currentPath,
            type: 'directory',
            children: [],
          }

          // Check for config.json
          const configContent = globResult[`knowledge/${currentPath}/config.json`]
          if (configContent) {
            try {
              dirNode.config = JSON.parse(configContent) as Record<string, unknown>
            } catch {
              // Invalid config, skip
            }
          }

          dirMap.set(currentPath, dirNode)

          if (parentPath) {
            dirMap.get(parentPath)?.children?.push(dirNode)
          } else {
            tree.push(dirNode)
          }
        }
      }

      // Add file if it's a markdown file
      if (relativePath.endsWith('.md')) {
        const content = globResult[filePath]
        const { frontmatter, body } = parseFrontmatter(content)

        const fileNode: KnowledgeNode = {
          path: relativePath,
          type: 'file',
          frontmatter,
          content: body,
        }

        const parentPath = parts.slice(0, -1).join('/')
        if (parentPath) {
          dirMap.get(parentPath)?.children?.push(fileNode)
        } else {
          tree.push(fileNode)
        }
      }
    }

    return tree
  }

  result.knowledge = buildKnowledgeTree(knowledgeFiles)

  return result
}

/**
 * Extracts all workspaces from an import.meta.glob result
 * @param globResult Result from import.meta.glob with { eager: true, as: 'raw' }
 *        Example: { 'education/agents/...': '...', 'plants/flows/...': '...' }
 */
export function extractAllWorkspaces(
  globResult: Record<string, string>
): ExtractedDataStructure {
  const result: ExtractedDataStructure = { workspaces: {} }

  // Extract workspace IDs from paths
  const workspaceIds = new Set<string>()
  for (const filePath of Object.keys(globResult)) {
    const match = filePath.match(/^([^/]+)\//)
    if (match) workspaceIds.add(match[1])
  }

  for (const workspaceId of workspaceIds) {
    console.log(`Extracting workspace: ${workspaceId}...`)

    // Filter glob result to only this workspace
    const workspaceGlob: Record<string, string> = {}
    const prefix = `${workspaceId}/`
    for (const [filePath, content] of Object.entries(globResult)) {
      if (filePath.startsWith(prefix)) {
        // Remove workspace prefix from path
        workspaceGlob[filePath.slice(prefix.length)] = content
      }
    }

    try {
      result.workspaces[workspaceId] = extractWorkspaceData(
        workspaceId,
        workspaceGlob
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Failed to extract workspace ${workspaceId}:`, message)
    }
  }

  return result
}
