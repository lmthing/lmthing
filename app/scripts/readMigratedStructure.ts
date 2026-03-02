import fs from 'fs/promises';
import path from 'path';

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
  name: string;
  description?: string;
  tools: string[];
  selectedDomains: string[];
}

interface AgentConfig {
  emptyFieldsForRuntime: string[] | Record<string, string[]>;
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
  type: 'file' | 'directory';
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

function parseFrontmatter<T = Record<string, any>>(content: string): { frontmatter: T; body: string } {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: {} as T, body: content };
  }

  const frontmatterLines = match[1].split('\n');
  const frontmatter: any = {};

  for (const line of frontmatterLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Try to parse as JSON for arrays and objects
    if (value.startsWith('[') || value.startsWith('{')) {
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

const OUTPUT_TAG_REGEX =
  /<output(?:\s+target="([^"]+)")?>\n([\s\S]*?)\n<\/output>/;

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
 * Reads a migrated workspace directory and returns the complete data structure
 * @param workspacePath Path to the workspace directory (e.g., './mock_data_new/education')
 */
async function extractWorkspaceData(workspacePath: string): Promise<WorkspaceData> {
  const workspaceId = path.basename(workspacePath);

  const result: WorkspaceData = {
    id: workspaceId,
    agents: {},
    flows: {},
    knowledge: [],
    packageJson: null,
  };

  // Read package.json if it exists
  try {
    const packageJsonPath = path.join(workspacePath, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    result.packageJson = JSON.parse(packageJsonContent);
  } catch {
    // package.json is optional
  }

  // Extract agents
  const agentsPath = path.join(workspacePath, 'agents');
  try {
    const agentDirs = await fs.readdir(agentsPath);

    for (const agentId of agentDirs) {
      const agentPath = path.join(agentsPath, agentId);
      const stat = await fs.stat(agentPath);
      if (!stat.isDirectory()) continue;

      const agent: AgentData = {
        id: agentId,
        frontmatter: {},
        mainInstruction: '',
        slashActions: [],
        config: { emptyFieldsForRuntime: [] },
        formValues: {},
        conversations: [],
      };

      // Read instruct.md
      try {
        const instructPath = path.join(agentPath, 'instruct.md');
        const instructContent = await fs.readFile(instructPath, 'utf8');
        const { frontmatter, body } = parseFrontmatter<AgentInstructFrontmatter>(instructContent);
        agent.frontmatter = frontmatter;
        agent.slashActions = parseSlashActions(body);
        agent.mainInstruction = body.replace(SLASH_ACTION_REGEX, '').trim();
      } catch (err: any) {
        console.warn(`Could not read instruct.md for agent ${agentId}: ${err.message}`);
      }

      // Read config.json
      try {
        const configPath = path.join(agentPath, 'config.json');
        const configContent = await fs.readFile(configPath, 'utf8');
        agent.config = JSON.parse(configContent);
      } catch (err: any) {
        console.warn(`Could not read config.json for agent ${agentId}: ${err.message}`);
      }

      // Read values.json
      try {
        const valuesPath = path.join(agentPath, 'values.json');
        const valuesContent = await fs.readFile(valuesPath, 'utf8');
        agent.formValues = JSON.parse(valuesContent);
      } catch (err: any) {
        console.warn(`Could not read values.json for agent ${agentId}: ${err.message}`);
      }

      // Read conversations
      const conversationsPath = path.join(agentPath, 'conversations');
      try {
        const conversationFiles = await fs.readdir(conversationsPath);
        for (const convFile of conversationFiles) {
          if (!convFile.endsWith('.json')) continue;
          const convPath = path.join(conversationsPath, convFile);
          const convContent = await fs.readFile(convPath, 'utf8');
          const conversation = JSON.parse(convContent);
          agent.conversations.push(conversation);
        }
      } catch {
        // conversations directory may not exist
      }

      result.agents[agentId] = agent;
    }
  } catch (err: any) {
    console.warn(`Could not read agents directory: ${err.message}`);
  }

  // Extract flows
  const flowsPath = path.join(workspacePath, 'flows');
  try {
    const flowDirs = await fs.readdir(flowsPath);

    for (const flowId of flowDirs) {
      const flowPath = path.join(flowsPath, flowId);
      const stat = await fs.stat(flowPath);
      if (!stat.isDirectory()) continue;

      const flow: FlowData = {
        id: flowId,
        frontmatter: {},
        description: '',
        tasks: [],
      };

      // Read index.md
      try {
        const indexPath = path.join(flowPath, 'index.md');
        const indexContent = await fs.readFile(indexPath, 'utf8');
        const { frontmatter, body } = parseFrontmatter<FlowFrontmatter>(indexContent);
        flow.frontmatter = frontmatter;
        flow.description = body;
      } catch (err: any) {
        console.warn(`Could not read index.md for flow ${flowId}: ${err.message}`);
      }

      // Read task files
      const flowFiles = await fs.readdir(flowPath);
      const taskFiles = flowFiles.filter(f => f !== 'index.md' && f.endsWith('.md'));

      for (const taskFile of taskFiles) {
        const taskPath = path.join(flowPath, taskFile);
        const taskContent = await fs.readFile(taskPath, 'utf8');
        const { frontmatter, body } = parseFrontmatter<TaskFrontmatter>(taskContent);

        // Extract order and name from filename: {order}.{name}.md
        const parts = taskFile.replace('.md', '').split('.');
        const order = parseInt(parts[0], 10);
        const name = parts.slice(1).join('.');

        // Parse output tag if present
        const { outputSchema, targetFieldName } = parseOutputTag(body);

        // Remove output tag from instructions
        const instructions = body.replace(OUTPUT_TAG_REGEX, '').trim();

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

      // Sort tasks by order
      flow.tasks.sort((a, b) => a.order - b.order);

      result.flows[flowId] = flow;
    }
  } catch (err: any) {
    console.warn(`Could not read flows directory: ${err.message}`);
  }

  // Extract knowledge
  const knowledgePath = path.join(workspacePath, 'knowledge');
  try {
    async function processKnowledgeNode(dirPath: string, relativePath = ''): Promise<KnowledgeFileData[]> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const results: KnowledgeFileData[] = [];

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          // Check for config.json
          let config: any;
          try {
            const configPath = path.join(entryPath, 'config.json');
            const configContent = await fs.readFile(configPath, 'utf8');
            config = JSON.parse(configContent);
          } catch {
            // No config.json
          }

          const children = await processKnowledgeNode(entryPath, entryRelativePath);

          results.push({
            path: entryRelativePath,
            type: 'directory',
            config,
            children,
          });
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const content = await fs.readFile(entryPath, 'utf8');
          const { frontmatter, body } = parseFrontmatter(content);

          results.push({
            path: entryRelativePath,
            type: 'file',
            frontmatter,
            content: body,
          });
        }
      }

      return results;
    }

    result.knowledge = await processKnowledgeNode(knowledgePath);
  } catch (err: any) {
    console.warn(`Could not read knowledge directory: ${err.message}`);
  }

  return result;
}

/**
 * Reads all workspaces from a migrated data directory
 * @param rootPath Path to the root directory containing all workspaces (e.g., './mock_data_new')
 */
async function extractAllWorkspaces(rootPath: string): Promise<MigratedDataStructure> {
  const result: MigratedDataStructure = { workspaces: {} };

  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '.DS_Store') continue;

    const workspacePath = path.join(rootPath, entry.name);
    console.log(`Extracting workspace: ${entry.name}...`);

    try {
      result.workspaces[entry.name] = await extractWorkspaceData(workspacePath);
    } catch (err: any) {
      console.error(`Failed to extract workspace ${entry.name}:`, err);
    }
  }

  return result;
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const rootPath = process.argv[2] || './src/demos';

  console.log(`Reading migrated data from: ${rootPath}`);
  const data = await extractAllWorkspaces(rootPath);

  // Output to stdout
  console.log('\n=== Extracted Data Structure ===\n');
  console.log(JSON.stringify(data, null, 2));

  // Also write to file
  const outputPath = path.resolve('./src/extracted_data_structure.json');
  await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
  console.log(`\nData written to: ${outputPath}`);
}

const isMain = process.argv[1] && (process.argv[1].endsWith('readMigratedStructure.ts') || process.argv[1].endsWith('readMigratedStructure'));

if (isMain) {
  main().catch(err => {
    console.error('Error:', err);
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
