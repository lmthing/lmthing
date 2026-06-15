/**
 * workspaceLoader — GitHub loader, NEW SPEC
 *
 * Reads a GitHub repository and produces a SpaceData using the new layout:
 *   agents/<slug>/instruct.md           → parsed frontmatter + body
 *   tasklists/<name>/NN-<id>.md         → Tasklist tasks
 *   knowledge/<domain>/<field>/index.md → KnowledgeFieldIndex + description
 *   knowledge/<domain>/<field>/<slug>.md → option content
 *   functions/<name>.ts                 → FunctionFile source
 *   components/view/<Name>.tsx          → ViewComponent source
 *   components/form/<Name>/{web,ink}.tsx → FormComponent
 */
import type { Octokit } from "@octokit/rest";
import type {
  Agent,
  AgentFrontmatter,
  AgentAction,
  Conversation,
  Task,
  TaskOutput,
  Tasklist,
  KnowledgeDomain,
  KnowledgeField,
  KnowledgeFieldIndex,
  FunctionFile,
  ViewComponent,
  FormComponent,
  SpaceComponents,
  PackageJson,
  SpaceEnv,
  EncryptedEnvFile,
  SpaceData,
} from "@/types/space-data";
import { parseEncryptedEnvFileContent } from "@/lib/envCrypto";

// ── Helpers ──────────────────────────────────────────────────────────────────

function decodeBase64Utf8(base64: string): string {
  const normalized = base64.replace(/\n/g, "");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

function parseFrontmatter<T = Record<string, unknown>>(
  content: string,
): { frontmatter: T; body: string } {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return { frontmatter: {} as T, body: content };
  const frontmatter = parseYaml(match[1]) as T;
  return { frontmatter, body: match[2].trim() };
}

function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    if (rest === "" || rest === "[]") {
      if (rest === "[]") { result[key] = []; i++; continue; }
      // Peek ahead to determine block sequence vs block mapping
      let peekIdx = i + 1;
      while (peekIdx < lines.length && !lines[peekIdx].trim()) peekIdx++;
      const peekLine = lines[peekIdx] ?? "";
      const isSequence = /^\s{2,}-\s/.test(peekLine);
      const isMapping = !isSequence && /^\s{2,}[^-\s]/.test(peekLine) && peekLine.includes(":");
      if (isMapping) {
        // Block mapping sub-object (e.g. output:\n  key: value)
        const obj: Record<string, unknown> = {};
        i++;
        while (i < lines.length && /^\s{2,}/.test(lines[i])) {
          parseInlineKv(lines[i].trim(), obj);
          i++;
        }
        result[key] = obj;
        continue;
      }
      const items: unknown[] = [];
      i++;
      while (i < lines.length && /^\s{2,}/.test(lines[i])) {
        const itemLine = lines[i].trim();
        if (itemLine.startsWith("- ")) {
          const itemRest = itemLine.slice(2).trim();
          if (itemRest.includes(":") && !itemRest.startsWith("{")) {
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
        } else { i++; }
      }
      result[key] = items;
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      result[key] = rest.slice(1, -1).trim()
        ? rest.slice(1, -1).split(",").map((v) => parseScalar(v.trim()))
        : [];
      i++;
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

function parseScalar(value: string): unknown {
  if (!value) return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  const num = Number(value);
  if (!isNaN(num) && value !== "") return num;
  if ((value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")))
    return value.slice(1, -1);
  return value;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
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

function parseAgentFrontmatter(raw: Record<string, unknown>): AgentFrontmatter {
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    knowledge: toStringArray(raw.knowledge),
    functions: toStringArray(raw.functions),
    components: toStringArray(raw.components),
    actions: parseActions(raw.actions),
    defaultAction: typeof raw.defaultAction === "string" ? raw.defaultAction : undefined,
    dependencies: toStringArray(raw.dependencies),
  };
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

// ── GitHub file listing ───────────────────────────────────────────────────────

type RepoTextFile = { path: string; content: string };

export interface GithubWorkspaceLoadProgress {
  loadedFiles: number;
  totalFiles: number;
  currentPath: string;
}

async function listRepoTextFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  onProgress?: (progress: GithubWorkspaceLoadProgress) => void,
): Promise<RepoTextFile[]> {
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch || "main";

  const { data: branch } = await octokit.rest.repos.getBranch({
    owner, repo, branch: defaultBranch,
  });
  const treeSha = branch.commit.commit.tree.sha;

  const { data: tree } = await octokit.rest.git.getTree({
    owner, repo, tree_sha: treeSha, recursive: "1",
  });

  const fileEntries = tree.tree
    .filter((e) => e.type === "blob" && Boolean(e.path) && Boolean(e.sha))
    .map((e) => ({ path: e.path as string, sha: e.sha as string }));

  const relevantEntries = fileEntries.filter((e) =>
    e.path === "package.json" ||
    /^\.env(?:\.[A-Za-z0-9_-]+)*$/.test(e.path) ||
    e.path.startsWith("agents/") ||
    e.path.startsWith("tasklists/") ||
    e.path.startsWith("knowledge/") ||
    e.path.startsWith("functions/") ||
    e.path.startsWith("components/"),
  );

  const files: RepoTextFile[] = [];
  const totalFiles = relevantEntries.length;
  let loadedFiles = 0;

  onProgress?.({ loadedFiles, totalFiles, currentPath: "Reading repository tree…" });

  for (const entry of relevantEntries) {
    onProgress?.({ loadedFiles, totalFiles, currentPath: entry.path });
    const { data: blob } = await octokit.rest.git.getBlob({ owner, repo, file_sha: entry.sha });
    files.push({ path: entry.path, content: decodeBase64Utf8(blob.content) });
    loadedFiles += 1;
    onProgress?.({ loadedFiles, totalFiles, currentPath: entry.path });
  }

  return files;
}

// ── Main loader ──────────────────────────────────────────────────────────────

export async function loadWorkspaceDataFromGithubRepo(params: {
  octokit: Octokit;
  owner: string;
  repo: string;
  workspaceId: string;
  onProgress?: (progress: GithubWorkspaceLoadProgress) => void;
}): Promise<SpaceData> {
  const { octokit, owner, repo, workspaceId, onProgress } = params;
  const files = await listRepoTextFiles(octokit, owner, repo, onProgress);

  const agents: Record<string, Agent> = {};
  const tasklists: Record<string, Tasklist> = {};
  const knowledge: Record<string, KnowledgeDomain> = {};
  const functions: Record<string, FunctionFile> = {};
  const components: SpaceComponents = { view: {}, form: {} };
  let packageJson: PackageJson | null = null;
  const env: SpaceEnv = {};

  for (const file of files) {
    // package.json
    if (file.path === "package.json") {
      try { packageJson = JSON.parse(file.content) as PackageJson; } catch { packageJson = null; }
      continue;
    }

    // .env files
    if (/^\.env(?:\.[A-Za-z0-9_-]+)*$/.test(file.path)) {
      const encrypted = parseEncryptedEnvFileContent(file.content);
      if (encrypted) env[file.path] = encrypted;
      continue;
    }

    // agents/<slug>/instruct.md or conversations
    const agentMatch = file.path.match(/^agents\/([^/]+)\/(.+)$/);
    if (agentMatch) {
      const agentId = agentMatch[1];
      const relative = agentMatch[2];

      if (!agents[agentId]) {
        agents[agentId] = {
          id: agentId,
          frontmatter: {
            title: "", knowledge: [], functions: [], components: [],
            actions: [], dependencies: [],
          },
          body: "",
          conversations: [],
        };
      }

      if (relative === "instruct.md") {
        const { frontmatter: raw, body } = parseFrontmatter<Record<string, unknown>>(file.content);
        agents[agentId].frontmatter = parseAgentFrontmatter(raw);
        agents[agentId].body = body.trim();
      } else if (relative.startsWith("conversations/") && relative.endsWith(".json")) {
        try {
          agents[agentId].conversations.push(JSON.parse(file.content) as Conversation);
        } catch { /* ignore */ }
      }
      continue;
    }

    // tasklists/<name>/NN-<id>.md
    const tasklistMatch = file.path.match(/^tasklists\/([^/]+)\/([^/]+\.md)$/i);
    if (tasklistMatch) {
      const name = tasklistMatch[1];
      const filename = tasklistMatch[2];
      if (!/^\d+[_-].+\.md$/i.test(filename)) continue;

      if (!tasklists[name]) tasklists[name] = { name, tasks: [] };

      const match = filename.match(/^(\d+)[_-](.+)\.md$/i);
      if (!match) continue;
      const order = parseInt(match[1], 10);
      const id = match[2];
      const { frontmatter: raw, body } = parseFrontmatter<Record<string, unknown>>(file.content);
      const dependsOn = toStringArray(raw.dependsOn);
      const task: Task = {
        order,
        id,
        instruction: body.trim(),
        output: parseTaskOutput(raw.output),
      };
      if (dependsOn.length > 0) task.dependsOn = dependsOn;
      if (raw.optional === true || raw.optional === "true") task.optional = true;
      if (raw.goal === true || raw.goal === "true") task.goal = true;
      if (typeof raw.condition === "string") task.condition = raw.condition;
      tasklists[name].tasks.push(task);
      continue;
    }

    // knowledge/<domain>/<field>/index.md or option files
    const knowledgeMatch = file.path.match(/^knowledge\/([^/]+)\/([^/]+)\/(.+)$/);
    if (knowledgeMatch) {
      const domain = knowledgeMatch[1];
      const field = knowledgeMatch[2];
      const fileName = knowledgeMatch[3];

      if (!knowledge[domain]) knowledge[domain] = { slug: domain, fields: {} };
      if (!knowledge[domain].fields[field]) {
        knowledge[domain].fields[field] = {
          slug: field,
          index: { type: "string", variable: "" },
          description: "",
          options: {},
        };
      }
      const fieldObj = knowledge[domain].fields[field];

      if (fileName === "index.md") {
        const { frontmatter: raw, body } = parseFrontmatter<Record<string, unknown>>(file.content);
        fieldObj.index = {
          type: typeof raw.type === "string" ? raw.type : "string",
          variable: typeof raw.variable === "string" ? raw.variable : "",
          default: typeof raw.default === "string" ? raw.default : undefined,
        };
        fieldObj.description = body.trim();
      } else if (fileName.endsWith(".md")) {
        fieldObj.options[fileName.replace(/\.md$/, "")] = file.content;
      }
      continue;
    }

    // functions/<name>.ts(x)?
    const fnMatch = file.path.match(/^functions\/([^/]+)\.(ts|tsx)$/);
    if (fnMatch) {
      functions[fnMatch[1]] = { name: fnMatch[1], source: file.content };
      continue;
    }

    // components/view/<Name>.tsx
    const viewMatch = file.path.match(/^components\/view\/([^/]+)\.tsx$/);
    if (viewMatch) {
      components.view[viewMatch[1]] = { name: viewMatch[1], source: file.content };
      continue;
    }

    // components/form/<Name>/{web,ink}.tsx
    const formMatch = file.path.match(/^components\/form\/([^/]+)\/(web|ink)\.tsx$/);
    if (formMatch) {
      const name = formMatch[1];
      const variant = formMatch[2] as "web" | "ink";
      if (!components.form[name]) components.form[name] = { name, web: "", ink: "" };
      components.form[name][variant] = file.content;
    }
  }

  // Sort tasklist tasks by order
  for (const tl of Object.values(tasklists)) {
    tl.tasks.sort((a, b) => a.order - b.order);
  }

  const fallbackPackageJson: PackageJson = {
    name: repo, version: "1.0.0", description: "", dependencies: {},
  };

  return {
    id: workspaceId,
    agents,
    tasklists,
    knowledge,
    functions,
    components,
    packageJson: packageJson || fallbackPackageJson,
    env,
  };
}
