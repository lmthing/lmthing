/**
 * extractWorkspaceData — NEW SPEC
 *
 * Parses the new on-disk space layout into SpaceData:
 *   agents/<slug>/instruct.md           → AgentFrontmatter + body
 *   tasklists/<name>/NN-<id>.md         → Tasklist[]
 *   knowledge/<domain>/<field>/index.md → KnowledgeFieldIndex + description
 *   knowledge/<domain>/<field>/<slug>.md → options
 *   functions/<name>.ts                 → FunctionFile
 *   components/view/<Name>.tsx          → ViewComponent
 *   components/form/<Name>/web.tsx      → FormComponent.web
 *   components/form/<Name>/ink.tsx      → FormComponent.ink
 */

import type {
  Agent,
  AgentFrontmatter,
  AgentAction,
  Conversation,
  SpaceData,
  ExtractedDataStructure,
  Tasklist,
  Task,
  TaskOutput,
  KnowledgeDomain,
  KnowledgeField,
  KnowledgeFieldIndex,
  FunctionFile,
  SpaceComponents,
  ViewComponent,
  FormComponent,
  PackageJson,
  SpaceEnv,
  EncryptedEnvFile,
} from "@/types/space-data";

// ============================================================================
// Frontmatter Parser (minimal YAML — handles the new multi-line block syntax)
// ============================================================================

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

export function parseFrontmatter<T = Record<string, unknown>>(
  content: string,
): { frontmatter: T; body: string } {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: {} as T, body: content };
  }
  const frontmatter = parseYaml(match[1]) as T;
  return { frontmatter, body: match[2].trim() };
}

function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // skip empty lines
    if (!line.trim()) { i++; continue; }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    if (rest === "" || rest === "[]" || rest === "{}") {
      // Could be a block list, block mapping, or empty
      if (rest === "[]") { result[key] = []; i++; continue; }
      if (rest === "{}") { result[key] = {}; i++; continue; }
      // Peek at the next non-empty indented line to determine sequence vs mapping
      let peekIdx = i + 1;
      while (peekIdx < lines.length && !lines[peekIdx].trim()) peekIdx++;
      const peekLine = lines[peekIdx] ?? "";
      const isSequence = /^\s{2,}-\s/.test(peekLine);
      const isMapping = !isSequence && /^\s{2,}[^-\s]/.test(peekLine) && peekLine.includes(":");

      if (isSequence) {
        // Block sequence
        const items: unknown[] = [];
        i++;
        while (i < lines.length && /^\s{2,}/.test(lines[i])) {
          const itemLine = lines[i].trim();
          if (itemLine.startsWith("- ")) {
            const itemRest = itemLine.slice(2).trim();
            if (itemRest.includes(":") && !itemRest.startsWith("{")) {
              // Block mapping item
              const obj: Record<string, unknown> = {};
              parseInlineKv(itemRest, obj);
              i++;
              while (i < lines.length && /^\s{4,}/.test(lines[i])) {
                parseInlineKv(lines[i].trim(), obj);
                i++;
              }
              items.push(obj);
            } else {
              items.push(parseScalar(itemRest));
              i++;
            }
          } else {
            break;
          }
        }
        result[key] = items;
      } else if (isMapping) {
        // Block mapping (sub-object like `output:\n  key: value`)
        const obj: Record<string, unknown> = {};
        i++;
        while (i < lines.length && /^\s{2,}/.test(lines[i])) {
          parseInlineKv(lines[i].trim(), obj);
          i++;
        }
        result[key] = obj;
      } else {
        result[key] = {};
        i++;
      }
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      // Inline array
      result[key] = parseInlineArray(rest);
    } else {
      result[key] = parseScalar(rest);
      i++;
    }
  }

  return result;
}

function parseInlineKv(text: string, target: Record<string, unknown>): void {
  const colonIdx = text.indexOf(":");
  if (colonIdx === -1) return;
  const k = text.slice(0, colonIdx).trim();
  const v = text.slice(colonIdx + 1).trim();
  if (k) target[k] = parseScalar(v);
}

function parseInlineArray(text: string): unknown[] {
  const inner = text.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(",").map((v) => parseScalar(v.trim()));
}

function parseScalar(value: string): unknown {
  if (!value) return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  const num = Number(value);
  if (!isNaN(num) && value !== "") return num;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

// ============================================================================
// Agent Parsing
// ============================================================================

function parseStringArrayMap(value: unknown): Record<string, string[]> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const result: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = toStringArray(v);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseObjectMap(value: unknown): Record<string, Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const result: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      result[k] = v as Record<string, unknown>;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseAgentFrontmatter(raw: Record<string, unknown>): AgentFrontmatter {
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    knowledge: toStringArray(raw.knowledge),
    functions: toStringArray(raw.functions),
    components: toStringArray(raw.components),
    actions: parseActions(raw.actions),
    defaultAction: typeof raw.defaultAction === "string" ? raw.defaultAction : undefined,
    dependencies: toStringArray(raw.dependencies),
    runtimeFields: parseStringArrayMap(raw.runtimeFields),
    formValues: parseObjectMap(raw.formValues),
  };
}

function parseActions(value: unknown): AgentAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      id: typeof v.id === "string" ? v.id : "",
      label: typeof v.label === "string" ? v.label : "",
      description: typeof v.description === "string" ? v.description : "",
      tasklist: typeof v.tasklist === "string" ? v.tasklist : "",
    }));
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.trim() !== "") return [value];
  return [];
}

// ============================================================================
// Tasklist Parsing
// ============================================================================

function parseTaskFile(filename: string, content: string): Task | null {
  // filename: "01-boil_water.md"
  const match = filename.match(/^(\d+)[_-](.+)\.md$/i);
  if (!match) return null;
  const order = parseInt(match[1], 10);
  const id = match[2];

  const { frontmatter: raw, body } = parseFrontmatter<Record<string, unknown>>(content);

  const output = parseTaskOutput(raw.output);
  const dependsOn = toStringArray(raw.dependsOn);
  const optional = raw.optional === true || raw.optional === "true";
  const goal = raw.goal === true || raw.goal === "true";
  const condition = typeof raw.condition === "string" ? raw.condition : undefined;

  const task: Task = {
    order,
    id,
    instruction: body.trim(),
    output,
  };
  if (dependsOn.length > 0) task.dependsOn = dependsOn;
  if (optional) task.optional = optional;
  if (goal) task.goal = goal;
  if (condition !== undefined) task.condition = condition;

  return task;
}

function parseTaskOutput(value: unknown): TaskOutput {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const out: TaskOutput = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = typeof v === "string" ? v : String(v);
    }
    return out;
  }
  return { result: "string" };
}

// ============================================================================
// Knowledge Parsing
// ============================================================================

function parseKnowledgeFieldIndex(content: string): { index: KnowledgeFieldIndex; description: string } {
  const { frontmatter: raw, body } = parseFrontmatter<Record<string, unknown>>(content);
  return {
    index: {
      type: typeof raw.type === "string" ? raw.type : "string",
      variable: typeof raw.variable === "string" ? raw.variable : "",
      default: typeof raw.default === "string" ? raw.default : undefined,
      label: typeof raw.label === "string" ? raw.label : undefined,
      fieldType: typeof raw.fieldType === "string" ? raw.fieldType : undefined,
      required: typeof raw.required === "boolean" ? raw.required : undefined,
      renderAs: typeof raw.renderAs === "string" ? raw.renderAs : undefined,
    },
    description: body.trim(),
  };
}

function parseKnowledgeDomainIndex(content: string): { label?: string; icon?: string; color?: string; description?: string } {
  const { frontmatter: raw, body } = parseFrontmatter<Record<string, unknown>>(content);
  return {
    label: typeof raw.label === "string" ? raw.label : undefined,
    icon: typeof raw.icon === "string" ? raw.icon : undefined,
    color: typeof raw.color === "string" ? raw.color : undefined,
    description: body.trim() || undefined,
  };
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extracts a SpaceData from an import.meta.glob result (or any flat map of
 * path → file content).
 *
 * @param spaceId  The space identifier.
 * @param globResult  A flat map: { 'agents/chef/instruct.md': '...', ... }
 */
export function extractWorkspaceData(
  spaceId: string,
  globResult: Record<string, string>,
): SpaceData {
  const result: SpaceData = {
    id: spaceId,
    agents: {},
    tasklists: {},
    knowledge: {},
    functions: {},
    components: { view: {}, form: {} },
    packageJson: null,
    env: {},
  };

  // ── package.json ────────────────────────────────────────────────────────
  const packageJsonContent = globResult["package.json"];
  if (packageJsonContent) {
    try {
      result.packageJson = JSON.parse(packageJsonContent) as PackageJson;
    } catch {
      // keep null
    }
  }

  // ── .env files ──────────────────────────────────────────────────────────
  for (const [filePath, content] of Object.entries(globResult)) {
    if (/^\.env(?:\.[A-Za-z0-9_-]+)*$/.test(filePath)) {
      try {
        const encrypted = JSON.parse(content) as EncryptedEnvFile;
        result.env![filePath] = encrypted;
      } catch {
        // not valid JSON — ignore
      }
    }
  }

  // ── Agents ──────────────────────────────────────────────────────────────
  const agentIds = new Set<string>();
  for (const filePath of Object.keys(globResult)) {
    const m = filePath.match(/^agents\/([^/]+)\//);
    if (m) agentIds.add(m[1]);
  }

  for (const agentId of agentIds) {
    const agent: Agent = {
      id: agentId,
      frontmatter: {
        title: "",
        knowledge: [],
        functions: [],
        components: [],
        actions: [],
        dependencies: [],
      },
      body: "",
      conversations: [],
    };

    // instruct.md only — no config.json or values.json in new spec
    const instructContent = globResult[`agents/${agentId}/instruct.md`];
    if (instructContent) {
      const { frontmatter: raw, body } = parseFrontmatter<Record<string, unknown>>(instructContent);
      agent.frontmatter = parseAgentFrontmatter(raw);
      agent.body = body.trim();
    }

    // conversations (still supported)
    for (const filePath of Object.keys(globResult)) {
      const convMatch = filePath.match(/^agents\/([^/]+)\/conversations\/(.+\.json)$/);
      if (convMatch && convMatch[1] === agentId) {
        try {
          const conv = JSON.parse(globResult[filePath]) as Conversation;
          agent.conversations.push(conv);
        } catch {
          // ignore
        }
      }
    }

    result.agents[agentId] = agent;
  }

  // ── Tasklists ────────────────────────────────────────────────────────────
  const tasklistNames = new Set<string>();
  for (const filePath of Object.keys(globResult)) {
    const m = filePath.match(/^tasklists\/([^/]+)\//);
    if (m) tasklistNames.add(m[1]);
  }

  for (const name of tasklistNames) {
    const tasks: Task[] = [];

    for (const filePath of Object.keys(globResult)) {
      const m = filePath.match(/^tasklists\/([^/]+)\/([^/]+\.md)$/i);
      if (!m || m[1] !== name) continue;
      const filename = m[2];
      if (!/^\d+[_-].+\.md$/i.test(filename)) continue;

      const task = parseTaskFile(filename, globResult[filePath]);
      if (task) tasks.push(task);
    }

    tasks.sort((a, b) => a.order - b.order);

    result.tasklists[name] = { name, tasks };
  }

  // ── Knowledge ────────────────────────────────────────────────────────────
  // Layout:
  //   knowledge/<domain>/index.md              — domain metadata (optional)
  //   knowledge/<domain>/<field>/index.md      — field manifest
  //   knowledge/<domain>/<field>/<slug>.md     — option files
  for (const filePath of Object.keys(globResult)) {
    if (!filePath.startsWith("knowledge/")) continue;

    const rel = filePath.slice("knowledge/".length);
    const parts = rel.split("/");

    if (parts.length < 2) continue; // bare file at knowledge/ root — skip

    const domain = parts[0];

    if (!result.knowledge[domain]) {
      result.knowledge[domain] = { slug: domain, fields: {} };
    }
    const domainObj = result.knowledge[domain];

    if (parts.length === 2) {
      // knowledge/<domain>/index.md — domain metadata
      const fileName = parts[1];
      if (fileName === "index.md") {
        const meta = parseKnowledgeDomainIndex(globResult[filePath]);
        if (meta.label !== undefined) domainObj.label = meta.label;
        if (meta.icon !== undefined) domainObj.icon = meta.icon;
        if (meta.color !== undefined) domainObj.color = meta.color;
        if (meta.description !== undefined) domainObj.description = meta.description;
      }
      continue;
    }

    const field = parts[1];

    if (!domainObj.fields[field]) {
      domainObj.fields[field] = {
        slug: field,
        index: { type: "string", variable: "" },
        description: "",
        options: {},
      };
    }
    const fieldObj = domainObj.fields[field];

    if (parts.length === 3) {
      const fileName = parts[2];
      if (fileName === "index.md") {
        const { index, description } = parseKnowledgeFieldIndex(globResult[filePath]);
        fieldObj.index = index;
        fieldObj.description = description;
      } else if (fileName.endsWith(".md")) {
        const slug = fileName.replace(/\.md$/, "");
        fieldObj.options[slug] = globResult[filePath];
      }
    }
  }

  // ── Functions ────────────────────────────────────────────────────────────
  for (const filePath of Object.keys(globResult)) {
    const m = filePath.match(/^functions\/([^/]+)\.(ts|tsx)$/);
    if (!m) continue;
    const name = m[1];
    result.functions[name] = { name, source: globResult[filePath] };
  }

  // ── Components ────────────────────────────────────────────────────────────
  for (const filePath of Object.keys(globResult)) {
    // components/view/<Name>.tsx
    const viewMatch = filePath.match(/^components\/view\/([^/]+)\.tsx$/);
    if (viewMatch) {
      const name = viewMatch[1];
      result.components.view[name] = { name, source: globResult[filePath] };
      continue;
    }
    // components/form/<Name>/web.tsx or ink.tsx
    const formMatch = filePath.match(/^components\/form\/([^/]+)\/(web|ink)\.tsx$/);
    if (formMatch) {
      const name = formMatch[1];
      const variant = formMatch[2] as "web" | "ink";
      if (!result.components.form[name]) {
        result.components.form[name] = { name, web: "", ink: "" };
      }
      result.components.form[name][variant] = globResult[filePath];
    }
  }

  return result;
}

/**
 * Extracts all spaces from a multi-space glob result.
 * Paths are expected to be prefixed with the space id: "<spaceId>/..."
 */
export function extractAllWorkspaces(globResult: Record<string, string>): ExtractedDataStructure {
  const result: ExtractedDataStructure = { spaces: {} };

  const spaceIds = new Set<string>();
  for (const filePath of Object.keys(globResult)) {
    const m = filePath.match(/^([^/]+)\//);
    if (m) spaceIds.add(m[1]);
  }

  for (const spaceId of spaceIds) {
    const spaceGlob: Record<string, string> = {};
    const prefix = `${spaceId}/`;
    for (const [filePath, content] of Object.entries(globResult)) {
      if (filePath.startsWith(prefix)) {
        spaceGlob[filePath.slice(prefix.length)] = content;
      }
    }

    try {
      result.spaces[spaceId] = extractWorkspaceData(spaceId, spaceGlob);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to extract space ${spaceId}:`, message);
    }
  }

  return result;
}
