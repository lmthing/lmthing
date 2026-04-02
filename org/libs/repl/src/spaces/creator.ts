/**
 * Space creation utilities for agent-generated spaces.
 *
 * Provides helpers for creating complete space structures using file blocks.
 */

export interface SpaceMetadata {
  name: string;
  version?: string;
  description?: string;
}

export interface AgentDefinition {
  name: string;
  role: string;
  instruct: string;
}

/**
 * Generate a package.json for a space.
 */
export function generatePackageJson(metadata: SpaceMetadata): string {
  return JSON.stringify(
    {
      name: metadata.name,
      version: metadata.version ?? '1.0.0',
      private: true,
    },
    null,
    2
  );
}

/**
 * Generate an agent config.json from an agent definition.
 */
export function generateAgentConfig(agent: AgentDefinition): string {
  return JSON.stringify(
    {
      title: agent.name,
      model: 'gpt-4',
      knowledge: [],
      components: [],
      functions: [],
    },
    null,
    2
  );
}

/**
 * Generate the file block content for a complete space structure.
 *
 * This returns a mapping of file paths to content that can be written
 * using 4-backtick file blocks.
 */
export function generateSpaceStructure(
  metadata: SpaceMetadata,
  agents: Record<string, AgentDefinition> = {}
): Record<string, string> {
  const files: Record<string, string> = {};

  // Root package.json
  files[`${metadata.name}/package.json`] = generatePackageJson(metadata);

  // Create agents
  for (const [agentId, agent] of Object.entries(agents)) {
    const agentFolder = `${metadata.name}/agents/agent-${agentId}`;
    files[`${agentFolder}/config.json`] = generateAgentConfig(agent);
    files[`${agentFolder}/instruct.md`] = `---
title: ${agent.name}
model: gpt-4
actions: []
---

# ${agent.role}

${agent.instruct}
`;
  }

  return files;
}

/**
 * Generate file block statements for a space.
 *
 * Returns an array of file block strings that can be emitted
 * by the agent to create a complete space.
 */
export function generateSpaceFileBlocks(
  metadata: SpaceMetadata,
  agents: Record<string, AgentDefinition> = {}
): string[] {
  const files = generateSpaceStructure(metadata, agents);
  const blocks: string[] = [];

  for (const [path, content] of Object.entries(files)) {
    blocks.push(`\`\`\`\`${path}\n${content}\n\`\`\`\`\n`);
  }

  return blocks;
}

/**
 * Validate a space name (kebab-case).
 */
export function validateSpaceName(name: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

/**
 * Slugify a string into a valid space name.
 */
export function slugifySpaceName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
