import path from "path";

// ============================================================================
// JSON Representation of the Migrated File Structure
// ============================================================================

/**
 * Complete data structure representing all migrated workspace data
 * {
 *   workspaces: {
 *     [workspaceId]: WorkspaceData
 *   }
 * }
 */

interface SlashAction {
  name: string;
  description: string;
  flowId: string;
  actionId: string;
}

interface AgentInstructFrontmatter {
  name?: string;
  description?: string;
  tools?: string[];
  enabledKnowledgeFields?: string[];
}

interface AgentConfig {
  runtimeFields: string[] | Record<string, string[]>;
}

interface AgentFormValues {
  [key: string]: any;
}

interface Conversation {
  id: string;
  agentId: string;
  [key: string]: any;
}

interface AgentData {
  id: string;
  frontmatter: AgentInstructFrontmatter;
  mainInstruction: string;
  slashActions: SlashAction[];
  config: AgentConfig;
  formValues: AgentFormValues;
  conversations: Conversation[];
}

interface TaskFrontmatter {
  description?: string;
  type?: string;
  [key: string]: any;
}

interface TaskData {
  order: number;
  name: string;
  frontmatter: TaskFrontmatter;
  instructions: string;
  outputSchema?: any;
  targetFieldName?: string;
}

interface FlowFrontmatter {
  [key: string]: any;
}

interface FlowData {
  id: string;
  frontmatter: FlowFrontmatter;
  description: string;
  tasks: TaskData[];
}

interface KnowledgeFileFrontmatter {
  [key: string]: any;
}

interface KnowledgeFileData {
  path: string;
  type: "file" | "directory";
  frontmatter?: KnowledgeFileFrontmatter;
  content?: string;
  config?: any;
  children?: KnowledgeFileData[];
}

interface PackageJson {
  name: string;
  version: string;
  description: string;
  dependencies: Record<string, string>;
}

interface WorkspaceData {
  id: string;
  agents: Record<string, AgentData>;
  flows: Record<string, FlowData>;
  knowledge: KnowledgeFileData[];
  packageJson: PackageJson | null;
}

interface MigratedDataStructure {
  workspaces: Record<string, WorkspaceData>;
}

// ============================================================================
// Frontmatter Parser
// ============================================================================

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

function parseFrontmatter<T = Record<string, any>>(
  content: string,
): { frontmatter: T; body: string } {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: {} as T, body: content };
  }

  const frontmatterLines = match[1].split("\n");
  const frontmatter: any = {};

  for (const line of frontmatterLines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Try to parse as JSON for arrays and objects
    if (value.startsWith("[") || value.startsWith("{")) {
      try {
        value = JSON.parse(value);
      } catch {
        // Keep as string if parsing fails
      }
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body: match[2].trim() };
}

// ============================================================================
// Slash Action Parser
// ============================================================================

const SLASH_ACTION_REGEX =
  /<slash_action\s+name="([^"]+)"\s+description="([^"]+)"\s+flowId="([^"]+)">\s*\/([^\s\n]+)\s*<\/slash_action>/g;

function parseSlashActions(content: string): SlashAction[] {
  const actions: SlashAction[] = [];
  let match;

  while ((match = SLASH_ACTION_REGEX.exec(content)) !== null) {
    actions.push({
      name: match[1],
      description: match[2],
      flowId: match[3],
      actionId: match[4].trim(),
    });
  }

  return actions;
}

// ============================================================================
// Output Tag Parser
// ============================================================================

const OUTPUT_TAG_REGEX = /<output(?:\s+target="([^"]+)")?>\n([\s\S]*?)\n<\/output>/;

function parseOutputTag(content: string): { outputSchema?: any; targetFieldName?: string } {
  const match = content.match(OUTPUT_TAG_REGEX);
  if (!match) return {};

  try {
    const outputSchema = JSON.parse(match[2]);
    return {
      outputSchema,
      targetFieldName: match[1] || undefined,
    };
  } catch {
    return {};
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
function extractWorkspaceData(
  workspaceId: string,
  globResult: Record<string, string>,
): WorkspaceData {
  const result: WorkspaceData = {
    id: workspaceId,
    agents: {},
    flows: {},
    knowledge: [],
    packageJson: null,
  };

  // Read package.json if it exists
  const packageJsonContent = globResult["package.json"];
  if (packageJsonContent) {
    try {
      result.packageJson = JSON.parse(packageJsonContent);
    } catch {
      // Invalid JSON
    }
  }

  // Extract agents
  const agentIds = new Set<string>();
  for (const filePath of Object.keys(globResult)) {
    const match = filePath.match(/^agents\/([^/]+)\//);
    if (match) agentIds.add(match[1]);
  }

  for (const agentId of agentIds) {
    const agent: AgentData = {
      id: agentId,
      frontmatter: {},
      mainInstruction: "",
      slashActions: [],
      config: { runtimeFields: [] },
      formValues: {},
      conversations: [],
    };

    // Read instruct.md
    const instructContent = globResult[`agents/${agentId}/instruct.md`];
    if (instructContent) {
      const { frontmatter, body } = parseFrontmatter<AgentInstructFrontmatter>(instructContent);
      agent.frontmatter = frontmatter;
      agent.slashActions = parseSlashActions(body);
      agent.mainInstruction = body.replace(SLASH_ACTION_REGEX, "").trim();
    }

    // Read config.json
    const configContent = globResult[`agents/${agentId}/config.json`];
    if (configContent) {
      try {
        agent.config = JSON.parse(configContent);
      } catch (err: any) {
        console.warn(`Invalid config.json for agent ${agentId}: ${err.message}`);
      }
    }

    // Read values.json
    const valuesContent = globResult[`agents/${agentId}/values.json`];
    if (valuesContent) {
      try {
        agent.formValues = JSON.parse(valuesContent);
      } catch (err: any) {
        console.warn(`Invalid values.json for agent ${agentId}: ${err.message}`);
      }
    }

    // Read conversations
    for (const filePath of Object.keys(globResult)) {
      const convMatch = filePath.match(/^agents\/([^/]+)\/conversations\/(.+\.json)$/);
      if (convMatch && convMatch[1] === agentId) {
        try {
          const conversation = JSON.parse(globResult[filePath]);
          agent.conversations.push(conversation);
        } catch (err: any) {
          console.warn(`Invalid conversation file ${filePath}: ${err.message}`);
        }
      }
    }

    result.agents[agentId] = agent;
  }

  // Extract flows
  const flowIds = new Set<string>();
  for (const filePath of Object.keys(globResult)) {
    const match = filePath.match(/^flows\/([^/]+)\//);
    if (match) flowIds.add(match[1]);
  }

  for (const flowId of flowIds) {
    const flow: FlowData = {
      id: flowId,
      frontmatter: {},
      description: "",
      tasks: [],
    };

    // Read index.md
    const indexContent = globResult[`flows/${flowId}/index.md`];
    if (indexContent) {
      const { frontmatter, body } = parseFrontmatter<FlowFrontmatter>(indexContent);
      flow.frontmatter = frontmatter;
      flow.description = body;
    }

    // Read task files
    for (const filePath of Object.keys(globResult)) {
      const taskMatch = filePath.match(/^flows\/([^/]+)\/([^/]+\.md)$/);
      if (taskMatch && taskMatch[1] === flowId && taskMatch[2] !== "index.md") {
        const taskFile = taskMatch[2];
        const taskContent = globResult[filePath];
        const { frontmatter, body } = parseFrontmatter<TaskFrontmatter>(taskContent);

        // Extract order and name from filename: {order}.{name}.md
        const parts = taskFile.replace(".md", "").split(".");
        const order = parseInt(parts[0], 10);
        const name = parts.slice(1).join(".");

        // Parse output tag if present
        const { outputSchema, targetFieldName } = parseOutputTag(body);

        // Remove output tag from instructions
        const instructions = body.replace(OUTPUT_TAG_REGEX, "").trim();

        const task: TaskData = {
          order,
          name,
          frontmatter,
          instructions,
          outputSchema,
          targetFieldName,
        };

        flow.tasks.push(task);
      }
    }

    // Sort tasks by order
    flow.tasks.sort((a, b) => a.order - b.order);

    result.flows[flowId] = flow;
  }

  // Extract knowledge
  const knowledgeFiles = Object.keys(globResult)
    .filter((p) => p.startsWith("knowledge/"))
    .sort();

  function buildKnowledgeTree(files: string[]): KnowledgeFileData[] {
    const tree: KnowledgeFileData[] = [];
    const dirMap = new Map<string, KnowledgeFileData>();

    for (const filePath of files) {
      const relativePath = filePath.replace(/^knowledge\//, "");
      const parts = relativePath.split("/");

      // Build directory structure
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        const dirName = parts[i];
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${dirName}` : dirName;

        if (!dirMap.has(currentPath)) {
          const dirNode: KnowledgeFileData = {
            path: currentPath,
            type: "directory",
            children: [],
          };

          // Check for config.json
          const configContent = globResult[`knowledge/${currentPath}/config.json`];
          if (configContent) {
            try {
              dirNode.config = JSON.parse(configContent);
            } catch {}
          }

          dirMap.set(currentPath, dirNode);

          if (parentPath) {
            dirMap.get(parentPath)?.children?.push(dirNode);
          } else {
            tree.push(dirNode);
          }
        }
      }

      // Add file if it's a markdown file
      if (relativePath.endsWith(".md")) {
        const content = globResult[filePath];
        const { frontmatter, body } = parseFrontmatter(content);

        const fileNode: KnowledgeFileData = {
          path: relativePath,
          type: "file",
          frontmatter,
          content: body,
        };

        const parentPath = parts.slice(0, -1).join("/");
        if (parentPath) {
          dirMap.get(parentPath)?.children?.push(fileNode);
        } else {
          tree.push(fileNode);
        }
      }
    }

    return tree;
  }

  result.knowledge = buildKnowledgeTree(knowledgeFiles);

  return result;
}

/**
 * Extracts all workspaces from an import.meta.glob result
 * @param globResult Result from import.meta.glob with { eager: true, as: 'raw' }
 *        Example: { 'education/agents/...': '...', 'plants/flows/...': '...' }
 */
function extractAllWorkspaces(globResult: Record<string, string>): MigratedDataStructure {
  const result: MigratedDataStructure = { workspaces: {} };

  // Extract workspace IDs from paths
  const workspaceIds = new Set<string>();
  for (const filePath of Object.keys(globResult)) {
    const match = filePath.match(/^([^/]+)\//);
    if (match) workspaceIds.add(match[1]);
  }

  for (const workspaceId of workspaceIds) {
    console.log(`Extracting workspace: ${workspaceId}...`);

    // Filter glob result to only this workspace
    const workspaceGlob: Record<string, string> = {};
    const prefix = `${workspaceId}/`;
    for (const [filePath, content] of Object.entries(globResult)) {
      if (filePath.startsWith(prefix)) {
        // Remove workspace prefix from path
        workspaceGlob[filePath.slice(prefix.length)] = content;
      }
    }

    try {
      result.workspaces[workspaceId] = extractWorkspaceData(workspaceId, workspaceGlob);
    } catch (err: any) {
      console.error(`Failed to extract workspace ${workspaceId}:`, err);
    }
  }

  return result;
}

// ============================================================================
// CLI (for testing - uses dynamic import to simulate the glob)
// ============================================================================

async function main() {
  const { default: fs } = await import("fs/promises");
  const rootPath = process.argv[2] || "./public/demos";

  console.log(`Reading migrated data from: ${rootPath}`);

  // Simulate import.meta.glob by reading files
  const globResult: Record<string, string> = {};

  async function walkDir(dir: string, prefix = "") {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walkDir(fullPath, relativePath);
      } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".json"))) {
        globResult[relativePath] = await fs.readFile(fullPath, "utf8");
      }
    }
  }

  await walkDir(rootPath);
  const data = extractAllWorkspaces(globResult);

  // Output to stdout
  console.log("\n=== Extracted Data Structure ===\n");
  console.log(JSON.stringify(data, null, 2));

  // Also write to file
  const outputPath = path.resolve("./src/extracted_data_structure.json");
  await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
  console.log(`\nData written to: ${outputPath}`);
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("readMigratedStructure.ts") ||
    process.argv[1].endsWith("readMigratedStructure"));

if (isMain) {
  main().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
}

// ============================================================================
// Exports
// ============================================================================

export {
  extractWorkspaceData,
  extractAllWorkspaces,
  parseFrontmatter,
  parseSlashActions,
  parseOutputTag,
};

export type {
  SlashAction,
  AgentInstructFrontmatter,
  AgentConfig,
  AgentFormValues,
  Conversation,
  AgentData,
  TaskFrontmatter,
  TaskData,
  FlowFrontmatter,
  FlowData,
  KnowledgeFileFrontmatter,
  KnowledgeFileData,
  PackageJson,
  WorkspaceData,
  MigratedDataStructure,
};
