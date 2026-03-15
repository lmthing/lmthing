/**
 * Knowledge Agent Plugin for lmthing
 *
 * Provides a defKnowledgeAgent method that reads a THING space's knowledge
 * structure and registers an agent whose tool input schema is derived from
 * the agent's runtimeFields configuration.
 *
 * Supports slash actions: when instruct.md contains <slash_action> tags,
 * sending the slash command as the agent's message triggers a flow.
 * Flows execute as sequential tasks (via defTaskList), where each step
 * produces structured output that feeds into subsequent steps.
 *
 * @example
 * import { knowledgeAgentPlugin } from 'lmthing/plugins';
 *
 * const { result } = await runPrompt(async ({ defKnowledgeAgent, $ }) => {
 *   defKnowledgeAgent(
 *     './spaces/education',
 *     './spaces/education/agents/agent-lesson-plan'
 *   );
 *   $`Call the LessonPlanAgent with message "/generate"`;
 * }, { model: 'openai:gpt-4o', plugins: [knowledgeAgentPlugin] });
 */

import { z } from "zod";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";
import type { StatefulPrompt } from "../../StatefulPrompt";
import type { Task } from "../types";

// --- Types ---

interface FieldConfig {
  label: string;
  description: string;
  fieldType: "select" | "multiSelect" | "text" | "number";
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
  slashActions: SlashAction[];
}

interface SlashAction {
  name: string;
  description: string;
  flowId: string;
  command: string;
}

interface OutputSpec {
  target: string;
  isArray: boolean;
  schema: Record<string, any>;
}

interface FlowStep {
  index: number;
  name: string;
  description: string;
  prompt: string;
  output: OutputSpec | null;
  model?: string;
  temperature?: number;
}

// --- File parsing ---

function parseFrontmatter(raw: string): { meta: Record<string, any>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta = yaml.load(match[1]) as Record<string, any>;
  return { meta: meta ?? {}, body: match[2].trim() };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

// --- Slash action parsing ---

function parseSlashActions(body: string): SlashAction[] {
  const actions: SlashAction[] = [];
  const regex = /<slash_action\s+([^>]+)>\s*\n\s*(\S+)\s*\n\s*<\/slash_action>/g;
  let match;
  while ((match = regex.exec(body)) !== null) {
    const attrs = match[1];
    const command = match[2];
    const name = attrs.match(/name="([^"]+)"/)?.[1] || "";
    const description = attrs.match(/description="([^"]+)"/)?.[1] || "";
    const flowId = attrs.match(/flowId="([^"]+)"/)?.[1] || "";
    actions.push({ name, description, flowId, command });
  }
  return actions;
}

function stripSlashActionTags(body: string): string {
  return body.replace(/<slash_action\s+[^>]+>\s*\n\s*\S+\s*\n\s*<\/slash_action>/g, "").trim();
}

// --- Output tag parsing ---

function parseOutputTag(body: string): { cleanBody: string; output: OutputSpec | null } {
  const regex = /<output\s+([^>]+)>\s*\n([\s\S]*?)\n\s*<\/output>/;
  const match = body.match(regex);
  if (!match) return { cleanBody: body, output: null };

  const attrs = match[1];
  const target = attrs.match(/target="([^"]+)"/)?.[1] || "";
  const isArray = /type=["']array["']/.test(attrs);
  let schema: Record<string, any> = {};
  try {
    schema = JSON.parse(match[2].trim());
  } catch {
    /* invalid schema, leave empty */
  }

  return {
    cleanBody: body.replace(regex, "").trim(),
    output: { target, isArray, schema },
  };
}

// --- Flow reading ---

function readFlowSteps(spacePath: string, flowId: string): FlowStep[] {
  const flowDir = join(spacePath, "flows", flowId);
  if (!existsSync(flowDir)) return [];

  const files = readdirSync(flowDir)
    .filter((f) => /^\d+\./.test(f) && f.endsWith(".md"))
    .sort((a, b) => parseInt(a) - parseInt(b));

  return files.map((file, i) => {
    const raw = readFileSync(join(flowDir, file), "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    const { cleanBody, output } = parseOutputTag(body);
    const name = file.replace(/^\d+\./, "").replace(/\.md$/, "");

    return {
      index: i,
      name,
      description: (meta.description as string) || "",
      prompt: cleanBody,
      output,
      model: meta.model as string | undefined,
      temperature: meta.temperature != null ? Number(meta.temperature) : undefined,
    };
  });
}

// --- Knowledge reading ---

function readKnowledgeFields(
  spacePath: string,
  runtimeFields: Record<string, string[]>,
): KnowledgeField[] {
  const fields: KnowledgeField[] = [];
  const knowledgePath = join(spacePath, "knowledge");

  for (const [domain, fieldSlugs] of Object.entries(runtimeFields)) {
    for (const fieldSlug of fieldSlugs) {
      const fieldPath = join(knowledgePath, domain, fieldSlug);
      const fieldConfigPath = join(fieldPath, "config.json");
      if (!existsSync(fieldConfigPath)) continue;

      const config = readJson<FieldConfig>(fieldConfigPath);

      const options: OptionMeta[] = [];
      for (const entry of readdirSync(fieldPath)) {
        if (!entry.endsWith(".md")) continue;
        const { meta, body } = parseFrontmatter(readFileSync(join(fieldPath, entry), "utf-8"));
        options.push({
          title: (meta.title as string) || entry.replace(".md", ""),
          description: (meta.description as string) || "",
          order: (meta.order as number) || 0,
          content: body,
          slug: entry.replace(".md", ""),
        });
      }

      options.sort((a, b) => a.order - b.order);
      fields.push({ config, options, domain, fieldSlug });
    }
  }

  return fields;
}

function readInstruct(agentPath: string): InstructMeta {
  const raw = readFileSync(join(agentPath, "instruct.md"), "utf-8");
  const { meta, body } = parseFrontmatter(raw);
  const slashActions = parseSlashActions(body);
  const cleanBody = stripSlashActionTags(body);
  return {
    name: (meta.name as string) || "Agent",
    description: (meta.description as string) || "",
    body: cleanBody,
    slashActions,
  };
}

// --- Schema building ---

function buildInputSchema(fields: KnowledgeField[], slashActions: SlashAction[]): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {
    message: z
      .string()
      .describe(
        slashActions.length > 0
          ? `The message or task to send to the agent. Slash commands: ${slashActions.map((a) => `"${a.command}" — ${a.description}`).join(", ")}`
          : "The message or task to send to the agent",
      ),
  };

  for (const field of fields) {
    const { config, options } = field;
    let fieldSchema: z.ZodTypeAny;

    switch (config.fieldType) {
      case "select": {
        const values = options.map((o) => o.slug);
        fieldSchema =
          values.length > 0
            ? z.enum(values as [string, ...string[]]).describe(config.description)
            : z.string().describe(config.description);
        break;
      }
      case "multiSelect": {
        const values = options.map((o) => o.slug);
        fieldSchema =
          values.length > 0
            ? z.array(z.enum(values as [string, ...string[]])).describe(config.description)
            : z.array(z.string()).describe(config.description);
        break;
      }
      case "text":
        fieldSchema = z.string().describe(config.description);
        break;
      case "number":
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

    if (field.config.fieldType === "multiSelect" && Array.isArray(selected)) {
      for (const v of selected) {
        const option = field.options.find((o) => o.slug === v);
        if (option) sections.push(`## ${field.config.label}: ${option.title}\n\n${option.content}`);
      }
    } else {
      const option = field.options.find((o) => o.slug === selected);
      if (option) sections.push(`## ${field.config.label}: ${option.title}\n\n${option.content}`);
    }
  }

  return sections.join("\n\n");
}

// --- JSON Schema → Zod conversion ---

function jsonSchemaToZod(schema: Record<string, any>): z.ZodTypeAny {
  return z.fromJSONSchema(schema) as z.ZodTypeAny;
}

// --- Flow execution on child prompt ---

const FLOW_OUTPUT_KEY = "knowledgeAgent_flowOutput";
const ACTIVE_FLOW_KEY = "knowledgeAgent_activeFlow";

function setupFlowOnPrompt(
  prompt: StatefulPrompt,
  flowSteps: FlowStep[],
  knowledgeContext: string,
): void {
  // Create tasks from flow steps
  const tasks: Task[] = flowSteps.map((step, i) => ({
    id: String(i + 1),
    name: step.name,
    status: "pending" as const,
  }));

  // Initialize task list on the child prompt
  prompt.defTaskList(tasks);

  // Flow output accumulator
  const [, setFlowOutput] = prompt.defState<Record<string, any>>(FLOW_OUTPUT_KEY, {});

  // Store flow steps for reference
  prompt.defState<FlowStep[]>(ACTIVE_FLOW_KEY, flowSteps);

  // Register a dedicated output tool for each step that has an <output> tag.
  // Each tool's input schema matches the step's JSON Schema exactly.
  for (const step of flowSteps) {
    if (!step.output) continue;

    const toolName = `output_${step.output.target}`;
    const zodSchema = jsonSchemaToZod(step.output.schema);
    const isArray = step.output.isArray;
    const target = step.output.target;

    prompt.defTool(
      toolName,
      `Submit output for flow step "${step.name}". Stores result at "${target}"${isArray ? " (appends to array)" : ""}.`,
      zodSchema,
      async (args: Record<string, any>) => {
        setFlowOutput((prev) => {
          const updated = { ...prev };
          if (isArray) {
            updated[target] = [...(updated[target] || []), args];
          } else {
            updated[target] = args;
          }
          return updated;
        });

        return {
          success: true,
          target,
          message: `Output stored at "${target}". Now call completeTask to finish this step.`,
        };
      },
    );
  }

  // Effect to inject current step context into the system prompt
  prompt.defEffect(() => {
    const currentTasks = prompt.getState<Task[]>("taskList") || [];
    const currentTask = currentTasks.find((t) => t.status === "in_progress");
    const flowOutput = prompt.getState<Record<string, any>>(FLOW_OUTPUT_KEY) || {};
    const steps = prompt.getState<FlowStep[]>(ACTIVE_FLOW_KEY) || [];

    if (!currentTask) {
      const allDone =
        currentTasks.length > 0 && currentTasks.every((t) => t.status === "completed");
      if (allDone) {
        prompt.defSystem(
          "flowContext",
          `# Flow Complete\n\nAll ${steps.length} steps completed.\n\n## Final Output\n\n\`\`\`json\n${JSON.stringify(flowOutput, null, 2)}\n\`\`\``,
        );
      }
      return;
    }

    const stepIndex = parseInt(currentTask.id) - 1;
    const step = steps[stepIndex];
    if (!step) return;

    let ctx = `# Current Flow Step ${stepIndex + 1}/${steps.length}: ${step.name}\n\n`;
    ctx += `## Step Instructions\n\n${step.prompt}\n\n`;

    if (step.output) {
      ctx += `## Required Output\n\n`;
      ctx += `Call the \`output_${step.output.target}\` tool with the following structure:\n\n`;
      ctx += `\`\`\`json\n${JSON.stringify(step.output.schema, null, 2)}\n\`\`\`\n\n`;
    }

    if (Object.keys(flowOutput).length > 0) {
      ctx += `## Output From Previous Steps\n\n\`\`\`json\n${JSON.stringify(flowOutput, null, 2)}\n\`\`\`\n\n`;
    }

    if (knowledgeContext) {
      ctx += `## Knowledge Context\n\n${knowledgeContext}\n`;
    }

    prompt.defSystem("flowContext", ctx);
  });

  // User message to kick off the flow
  prompt.addMessage({
    role: "user",
    content: [
      `Execute this flow with ${flowSteps.length} steps. For each step:`,
      `1. Call \`startTask\` to begin the step`,
      `2. Follow the step instructions in the system prompt`,
      `3. Call the step's \`output_*\` tool with the structured result`,
      `4. Call \`completeTask\` to finish the step`,
      ``,
      `Work through all steps in order. Start with step 1.`,
    ].join("\n"),
  });
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
 * If the agent's instruct.md contains <slash_action> tags, sending the slash
 * command as the message triggers a flow. The flow creates a task list from
 * the flow steps, and each step produces structured output (defined by
 * <output> tags in step files) that feeds into subsequent steps.
 *
 * @param spacePath  - Path to the space directory (e.g. `./spaces/education`)
 * @param agentPath  - Path to the specific agent directory (e.g. `./spaces/education/agents/agent-lesson-plan`)
 */
export function defKnowledgeAgent(this: StatefulPrompt, spacePath: string, agentPath: string) {
  const resolvedSpace = resolve(spacePath);
  const resolvedAgent = resolve(agentPath);

  // Read agent config & instruct
  const agentConfig = readJson<AgentRuntimeConfig>(join(resolvedAgent, "config.json"));
  const instruct = readInstruct(resolvedAgent);

  // Read knowledge fields from the space based on runtimeFields
  const runtimeFields = agentConfig.runtimeFields || {};
  const knowledgeFields = readKnowledgeFields(resolvedSpace, runtimeFields);

  // Pre-read all flows referenced by slash actions
  const flows = new Map<string, FlowStep[]>();
  for (const action of instruct.slashActions) {
    const steps = readFlowSteps(resolvedSpace, action.flowId);
    if (steps.length > 0) flows.set(action.flowId, steps);
  }

  // Build the tool input schema
  const inputSchema = buildInputSchema(knowledgeFields, instruct.slashActions);

  // Register as an agent
  this.defAgent(
    instruct.name,
    instruct.description,
    inputSchema,
    async (args: Record<string, any>, prompt: StatefulPrompt) => {
      const knowledgeContext = buildKnowledgeContext(knowledgeFields, args);
      const message = (args.message as string).trim();

      // Check if message is a slash command
      const matchedAction = instruct.slashActions.find(
        (a) => message === a.command || message.startsWith(a.command + " "),
      );

      if (matchedAction) {
        const flowSteps = flows.get(matchedAction.flowId);
        if (flowSteps && flowSteps.length > 0) {
          setupFlowOnPrompt(prompt, flowSteps, knowledgeContext);
          return;
        }
      }

      // Regular message — inject knowledge and forward
      if (knowledgeContext) {
        prompt.defSystem("knowledge", `# Knowledge Context\n\n${knowledgeContext}`);
      }
      prompt.addMessage({ role: "user", content: message });
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
 *     './spaces/education',
 *     './spaces/education/agents/agent-lesson-plan'
 *   );
 *   $`Call the LessonPlanAgent with message "/generate"`;
 * }, { model: 'openai:gpt-4o', plugins: [knowledgeAgentPlugin] });
 */
export const knowledgeAgentPlugin = {
  defKnowledgeAgent,
};
