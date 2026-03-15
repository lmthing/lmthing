/**
 * Knowledge Agent Plugin for lmthing
 *
 * Provides a defKnowledgeAgent method that reads a THING space's knowledge
 * structure and registers an agent whose tool input schema is derived from
 * the agent's runtimeFields configuration.
 *
 * @example
 * import { knowledgeAgentPlugin } from 'lmthing/plugins';
 *
 * const { result } = await runPrompt(async ({ defKnowledgeAgent, $ }) => {
 *   defKnowledgeAgent(
 *     './org/libs/thing/spaces/space-chat',
 *     './org/libs/thing/spaces/space-chat/agents/agent-chat-assistant'
 *   );
 *   $`Ask the ChatAssistant about model selection`;
 * }, { model: 'openai:gpt-4o', plugins: [knowledgeAgentPlugin] });
 */

import { z } from 'zod';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import yaml from 'js-yaml';
import type { StatefulPrompt } from '../../StatefulPrompt';

// --- Types ---

interface FieldConfig {
  label: string;
  description: string;
  fieldType: 'select' | 'multiSelect' | 'text' | 'number';
  required: boolean;
  default?: string;
  variableName: string;
  renderAs: string;
}

interface AgentRuntimeConfig {
  runtimeFields: Record<string, string[]>;
}

interface OptionMeta {
  title: string;
  description: string;
  order: number;
  content: string;
  slug: string;
}

interface KnowledgeField {
  config: FieldConfig;
  options: OptionMeta[];
  domain: string;
  fieldSlug: string;
}

interface InstructMeta {
  name: string;
  description: string;
  body: string;
}

// --- File parsing ---

function parseFrontmatter(raw: string): { meta: Record<string, any>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta = yaml.load(match[1]) as Record<string, any>;
  return { meta: meta ?? {}, body: match[2].trim() };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

// --- Knowledge reading ---

function readKnowledgeFields(spacePath: string, runtimeFields: Record<string, string[]>): KnowledgeField[] {
  const fields: KnowledgeField[] = [];
  const knowledgePath = join(spacePath, 'knowledge');

  for (const [domain, fieldSlugs] of Object.entries(runtimeFields)) {
    for (const fieldSlug of fieldSlugs) {
      const fieldPath = join(knowledgePath, domain, fieldSlug);
      const fieldConfigPath = join(fieldPath, 'config.json');
      if (!existsSync(fieldConfigPath)) continue;

      const config = readJson<FieldConfig>(fieldConfigPath);

      // Read option markdown files
      const options: OptionMeta[] = [];
      for (const entry of readdirSync(fieldPath)) {
        if (!entry.endsWith('.md')) continue;
        const { meta, body } = parseFrontmatter(readFileSync(join(fieldPath, entry), 'utf-8'));
        options.push({
          title: (meta.title as string) || entry.replace('.md', ''),
          description: (meta.description as string) || '',
          order: (meta.order as number) || 0,
          content: body,
          slug: entry.replace('.md', ''),
        });
      }

      options.sort((a, b) => a.order - b.order);
      fields.push({ config, options, domain, fieldSlug });
    }
  }

  return fields;
}

function readInstruct(agentPath: string): InstructMeta {
  const raw = readFileSync(join(agentPath, 'instruct.md'), 'utf-8');
  const { meta, body } = parseFrontmatter(raw);
  return {
    name: (meta.name as string) || 'Agent',
    description: (meta.description as string) || '',
    body,
  };
}

// --- Schema building ---

function buildInputSchema(fields: KnowledgeField[]): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {
    message: z.string().describe('The message or task to send to the agent'),
  };

  for (const field of fields) {
    const { config, options } = field;
    let fieldSchema: z.ZodTypeAny;

    switch (config.fieldType) {
      case 'select': {
        const values = options.map(o => o.slug);
        fieldSchema = values.length > 0
          ? z.enum(values as [string, ...string[]]).describe(config.description)
          : z.string().describe(config.description);
        break;
      }
      case 'multiSelect': {
        const values = options.map(o => o.slug);
        fieldSchema = values.length > 0
          ? z.array(z.enum(values as [string, ...string[]])).describe(config.description)
          : z.array(z.string()).describe(config.description);
        break;
      }
      case 'text':
        fieldSchema = z.string().describe(config.description);
        break;
      case 'number':
        fieldSchema = z.number().describe(config.description);
        break;
      default:
        fieldSchema = z.string().describe(config.description);
    }

    if (!config.required) {
      fieldSchema = fieldSchema.optional();
    }

    shape[config.variableName] = fieldSchema;
  }

  return z.object(shape);
}

// --- Knowledge context injection ---

function buildKnowledgeContext(fields: KnowledgeField[], values: Record<string, any>): string {
  const sections: string[] = [];

  for (const field of fields) {
    const selected = values[field.config.variableName] ?? field.config.default;
    if (selected == null) continue;

    if (field.config.fieldType === 'multiSelect' && Array.isArray(selected)) {
      for (const v of selected) {
        const option = field.options.find(o => o.slug === v);
        if (option) sections.push(`## ${field.config.label}: ${option.title}\n\n${option.content}`);
      }
    } else {
      const option = field.options.find(o => o.slug === selected);
      if (option) sections.push(`## ${field.config.label}: ${option.title}\n\n${option.content}`);
    }
  }

  return sections.join('\n\n');
}

// --- Plugin method ---

/**
 * Registers a THING space agent as a callable tool.
 *
 * Reads the agent's config.json to discover runtimeFields, then reads the
 * corresponding knowledge domains/fields/options to build a Zod input schema.
 * The agent's instruct.md becomes the system prompt, and selected knowledge
 * options are injected as context when the tool is called.
 *
 * @param spacePath  - Path to the space directory (e.g. `./spaces/space-chat`)
 * @param agentPath  - Path to the specific agent directory (e.g. `./spaces/space-chat/agents/agent-chat-assistant`)
 */
export function defKnowledgeAgent(
  this: StatefulPrompt,
  spacePath: string,
  agentPath: string,
) {
  const resolvedSpace = resolve(spacePath);
  const resolvedAgent = resolve(agentPath);

  // Read agent config & instruct
  const agentConfig = readJson<AgentRuntimeConfig>(join(resolvedAgent, 'config.json'));
  const instruct = readInstruct(resolvedAgent);

  // Read knowledge fields from the space based on runtimeFields
  const knowledgeFields = readKnowledgeFields(resolvedSpace, agentConfig.runtimeFields);

  // Build the tool input schema
  const inputSchema = buildInputSchema(knowledgeFields);

  // Register as an agent
  this.defAgent(
    instruct.name,
    instruct.description,
    inputSchema,
    async (args: Record<string, any>, prompt: StatefulPrompt) => {
      // Inject selected knowledge as system context
      const knowledgeContext = buildKnowledgeContext(knowledgeFields, args);
      if (knowledgeContext) {
        prompt.defSystem('knowledge', `# Knowledge Context\n\n${knowledgeContext}`);
      }

      // Send the user's message
      prompt.addMessage({ role: 'user', content: args.message });
    },
    { system: instruct.body },
  );
}

/**
 * Knowledge Agent Plugin
 *
 * @category Plugins
 *
 * @example
 * import { knowledgeAgentPlugin } from 'lmthing/plugins';
 *
 * runPrompt(({ defKnowledgeAgent, $ }) => {
 *   defKnowledgeAgent(
 *     './spaces/space-chat',
 *     './spaces/space-chat/agents/agent-chat-assistant'
 *   );
 *   $`Use the ChatAssistant to help with model selection`;
 * }, { model: 'openai:gpt-4o', plugins: [knowledgeAgentPlugin] });
 */
export const knowledgeAgentPlugin = {
  defKnowledgeAgent,
};
