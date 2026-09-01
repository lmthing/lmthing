import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { parseCapabilities } from './capabilities.ts';
import { parseFrontmatter } from './frontmatter.ts';
import { loadKnowledge } from './knowledge.ts';
import { loadTasklists } from './tasklist.ts';
import { AGENT_FRONTMATTER_ALLOWED_KEYS, SpaceFormatError, type Agent, type Capability, type LoadOpts, type Problem, type Project, type Space, type SpaceFn, type Unsupported, type WebhookTrigger } from './types.ts';

const AGENT_KEYS = new Set<string>(AGENT_FRONTMATTER_ALLOWED_KEYS);

async function existsDir(path: string): Promise<boolean> { try { return (await stat(path)).isDirectory(); } catch { return false; } }
async function entries(path: string) { try { return await readdir(path, { withFileTypes: true }); } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
function list(value: unknown, path: string, problems: Problem[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) { problems.push({ path, message: 'must be a list of strings' }); return []; }
  return value;
}
function problemFrom(error: unknown, path: string): Problem { return { path, message: error instanceof Error ? error.message.replace(/^.*?:\s*/, '') : String(error) }; }

async function loadFunctions(dir: string, opts: LoadOpts | undefined, problems: Problem[], spaceDir: string): Promise<SpaceFn[]> {
  const functions: SpaceFn[] = [];
  // Built once per space: an extractor is space-scoped (its TS Program is rooted at this
  // space's functions/), so a shared instance would resolve one space's types against another's.
  const extractor = opts?.extractorFor?.(spaceDir);
  for (const entry of (await entries(dir)).filter((item) => item.isFile() && item.name.endsWith('.ts')).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = join(dir, entry.name); const name = basename(entry.name, '.ts');
    // Type-only support modules (such as types.ts) are not callable space functions.
    const source = await readFile(file, 'utf8');
    if (!new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`).test(source)) continue;
    try {
      functions.push(extractor ? await extractor.extract(file, name) : {
        name, file, description: '', schema: { type: 'object', properties: {} }, order: [], verdict: { kind: 'degraded', param: '', reason: 'no extractor' },
      });
    } catch (error) { problems.push(problemFrom(error, relative(dir, file))); }
  }
  return functions;
}

/** Parse one space directory without importing the LMThing runtime. */
export async function loadSpace(dir: string, project = 'default', opts?: LoadOpts): Promise<Space> {
  const root = resolve(dir); const problems: Problem[] = []; const unsupported: Unsupported[] = [];
  const id = basename(root);
  let manifest: unknown = null;
  try { manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')); } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') problems.push(problemFrom(error, 'package.json')); }
  for (const name of ['components', 'events', 'hooks']) if (await existsDir(join(root, name))) unsupported.push({ path: `${name}/`, reason: `${name} are Unsupported by this standalone MCP server` });

  let knowledge: Space['knowledge'] = []; let tasklists: Space['tasklists'] = {}; let functions: SpaceFn[] = [];
  try { knowledge = await loadKnowledge(join(root, 'knowledge')); } catch (error) { problems.push(problemFrom(error, 'knowledge')); }
  try { tasklists = await loadTasklists(join(root, 'tasklists'), root, unsupported); } catch (error) { problems.push(problemFrom(error, 'tasklists')); }
  functions = await loadFunctions(join(root, 'functions'), opts, problems, root);

  const agents: Agent[] = [];
  const agentsDir = join(root, 'agents');
  if (!(await existsDir(agentsDir))) problems.push({ path: 'agents/', message: 'space requires an agents directory' });
  const agentDirs = (await entries(agentsDir)).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  if (await existsDir(agentsDir) && agentDirs.length === 0) problems.push({ path: 'agents/', message: 'space requires at least one agent directory' });
  for (const entry of agentDirs) {
    const slug = entry.name; const agentDir = join(agentsDir, slug); const instructFile = join(agentDir, 'instruct.md');
    let data: Record<string, unknown> = {}; let instruct = '';
    try { ({ data, body: instruct } = parseFrontmatter(await readFile(instructFile, 'utf8'), relative(root, instructFile))); }
    catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { problems.push(problemFrom(error, relative(root, instructFile))); continue; }
    }
    const disallowed = Object.keys(data).filter((key) => !AGENT_KEYS.has(key));
    if (disallowed.length) problems.push({ path: relative(root, instructFile), message: `disallowed frontmatter key(s): ${disallowed.join(', ')}` });
    let charter = '';
    try { charter = parseFrontmatter(await readFile(join(agentDir, 'charter.md'), 'utf8'), relative(root, join(agentDir, 'charter.md'))).body; }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') problems.push(problemFrom(error, relative(root, join(agentDir, 'charter.md')))); }
    let capabilities: Capability[] = [];
    try { capabilities = parseCapabilities(data.capabilities, relative(root, instructFile)); } catch (error) { problems.push(problemFrom(error, relative(root, instructFile))); }
    const functionsForAgent = list(data.functions, `${relative(root, instructFile)} functions`, problems);
    const knowledgeForAgent = list(data.knowledge, `${relative(root, instructFile)} knowledge`, problems);
    const delegationValue = data.canDelegateTo === undefined ? data.dependencies : data.canDelegateTo;
    const canDelegateTo = delegationValue === undefined ? undefined : list(delegationValue, `${relative(root, instructFile)} canDelegateTo`, problems);
    const actions = Array.isArray(data.actions) ? data.actions.flatMap((action): Agent['actions'] => {
      if (action === null || typeof action !== 'object' || Array.isArray(action)) { problems.push({ path: relative(root, instructFile), message: 'action must be a mapping' }); return []; }
      const item = action as Record<string, unknown>; const actionId = item.id;
      if (typeof actionId !== 'string') { problems.push({ path: relative(root, instructFile), message: 'action requires id' }); return []; }
      return [{ id: actionId, label: typeof item.label === 'string' ? item.label : undefined, description: typeof item.description === 'string' ? item.description : undefined, tasklist: typeof item.tasklist === 'string' ? item.tasklist : undefined }];
    }) : data.actions === undefined ? [] : (problems.push({ path: relative(root, instructFile), message: 'actions must be a list' }), []);
    const defaultAction = typeof data.defaultAction === 'string' ? data.defaultAction : undefined;
    const model = typeof data.model === 'string' ? data.model : undefined;
    let triggers: WebhookTrigger[] | undefined;
    if (data.triggers !== undefined) {
      if (!Array.isArray(data.triggers)) problems.push({ path: relative(root, instructFile), message: 'triggers must be a list' });
      else triggers = data.triggers.flatMap((trigger): WebhookTrigger[] => {
        const webhook = trigger !== null && typeof trigger === 'object' && !Array.isArray(trigger) ? (trigger as Record<string, unknown>).webhook : undefined;
        if (webhook === null || typeof webhook !== 'object' || Array.isArray(webhook) || typeof (webhook as Record<string, unknown>).path !== 'string') { problems.push({ path: relative(root, instructFile), message: 'trigger requires webhook.path' }); return []; }
        const record = webhook as Record<string, unknown>;
        return [{ path: record.path as string, provider: typeof record.provider === 'string' ? record.provider : undefined }];
      });
    }
    agents.push({ ref: `${project}/${id}/${slug}`, project, space: id, slug, title: typeof data.title === 'string' ? data.title : slug, charter, instruct, functions: functionsForAgent, knowledge: knowledgeForAgent, capabilities, canDelegateTo, actions, defaultAction, model, triggers });
  }
  const functionNames = new Set(functions.map((fn) => fn.name));
  const knowledgeRefs = new Set(knowledge.flatMap((domain) => domain.fields.flatMap((field) => [field.ref, ...field.options.map((option) => option.ref)])));
  for (const agent of agents) {
    for (const name of agent.functions) if (!functionNames.has(name)) problems.push({ path: `agents/${agent.slug}/instruct.md`, message: `unknown function "${name}"` });
    for (const ref of agent.knowledge) if (!knowledgeRefs.has(ref)) problems.push({ path: `agents/${agent.slug}/instruct.md`, message: `unknown knowledge ref "${ref}"` });
    for (const action of agent.actions) if (action.tasklist && !tasklists[action.tasklist]) problems.push({ path: `agents/${agent.slug}/instruct.md`, message: `unknown tasklist "${action.tasklist}"` });
  }
  if (problems.length) throw new SpaceFormatError(`Space "${project}/${id}" has ${problems.length} format problem(s)`, problems);
  return { id, project, ref: `${project}/${id}`, dir: root, agents, functions, knowledge, tasklists, manifest, unsupported };
}

/** Load every immediate directory under one project's spaces root, sorted by directory name. */
export async function loadSpaces(spacesDir: string, project = 'default', opts?: LoadOpts): Promise<Space[]> {
  const root = resolve(spacesDir);
  const dirs = (await entries(root)).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  return Promise.all(dirs.map((entry) => loadSpace(join(root, entry.name), project, opts)));
}

/**
 * Load EVERY project under a runtime root (`<cwd>/.lmthing`).
 *
 * One server instance serves the whole runtime, so a harness can reach any project's spaces and
 * then any agent without being restarted or repointed.
 *
 * A project directory with no `spaces/` is still reported, with an empty list — that is what
 * lets a caller see it exists and create a space in it. A missing runtime root is likewise an
 * empty result, not an error: a fresh cwd simply has no projects yet.
 */
export async function loadProjects(runtimeDir: string, opts?: LoadOpts): Promise<Project[]> {
  const root = resolve(runtimeDir);
  const dirs = (await entries(root)).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  const projects: Project[] = [];
  for (const entry of dirs) {
    const dir = join(root, entry.name); const spacesDir = join(dir, 'spaces');
    const spaces = (await existsDir(spacesDir)) ? await loadSpaces(spacesDir, entry.name, opts) : [];
    projects.push({ id: entry.name, dir, spacesDir, spaces });
  }
  return projects;
}

/** Every space across every project, in project-then-space order. */
export async function loadAllSpaces(runtimeDir: string, opts?: LoadOpts): Promise<Space[]> {
  return (await loadProjects(runtimeDir, opts)).flatMap((project) => project.spaces);
}
