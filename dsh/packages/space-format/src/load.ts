import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { parseCapabilities } from './capabilities.ts';
import { loadComponents } from './components.ts';
import { parseFrontmatter } from './frontmatter.ts';
import { loadKnowledge } from './knowledge.ts';
import type { ActionDef, AgentConfig, AgentDef, LoadSpaceOpts, Space, TasklistDir, WebhookTrigger } from './types.ts';

/**
 * The canonical LMThing space-format loader.
 *
 * This is the merge of three prior independent implementations
 * (`sdk/org/libs/core/src/spaces/load.ts`, `mcp/src/format/load.ts`, and this package's own
 * earlier JS port) — see `dsh/PROGRESS.md` (Part A1) for the full line-level comparison and every
 * design decision this file embodies. In one line: core/dsh's fail-immediately philosophy and
 * richer validation win as the default behavior (unchanged for the 7 existing
 * `@lmthing/dsh-space-*` consumers), with dsh's function-extension widening, mcp's deterministic
 * sorted enumeration, and a real bug fix (`self:author`, in `capabilities.ts`) folded in.
 *
 * Deliberately excluded (Part A1 design decision #8): `dependentSpaces`/npm-install recursion.
 * Installing packages is a side-effecting concern that doesn't belong in a pure parser; this
 * migration's own scope (agents/chat/orchestration only, no data/project-app bridging) has no use
 * for it either. A space's own `package.json` is still read for its `name`, nothing more.
 */

async function dirExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function listDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function listDirSorted(dir: string): Promise<string[]> {
  return (await listDir(dir)).sort();
}

/**
 * Extensions loaded from a space's `functions/` dir. LMThing's original QuickJS-sandbox runtime
 * only recognizes `.ts`/`.tsx`; this port's functions run as real Node ESM (dynamically
 * `import()`ed by `@lmthing/dsh-space-functions`), so `.js`/`.mjs` are equally legitimate — a
 * deliberate, documented widening for this port (Part A1 design decision #3), not an LMThing
 * behavior change.
 */
const FUNCTION_FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs'];

/**
 * Load the `functions/` directory under `dir`. Returns the original source for every recognized
 * file, keyed by basename. No export-shape gating (Part A1 design decision #3: `mcp/src/format`'s
 * regex-gated `export (async )?function <name>` check silently drops arrow-function exports —
 * core/dsh's laissez-faire "every matching file is a function" wins).
 */
export async function loadFunctionsFromDir(dir: string): Promise<Record<string, string>> {
  const functionsDir = join(dir, 'functions');
  if (!(await dirExists(functionsDir))) return {};

  const functions: Record<string, string> = {};
  for (const file of await listDirSorted(functionsDir)) {
    if (FUNCTION_FILE_EXTENSIONS.some((ext) => file.endsWith(ext))) {
      const name = basename(file, extname(file));
      functions[name] = await readFile(join(functionsDir, file), 'utf8');
    }
  }
  return functions;
}

async function loadTasklists(dir: string): Promise<Record<string, TasklistDir>> {
  const tasklistsDir = join(dir, 'tasklists');
  const result: Record<string, TasklistDir> = {};
  if (!(await dirExists(tasklistsDir))) return result;

  for (const slug of await listDirSorted(tasklistsDir)) {
    const tlDir = join(tasklistsDir, slug);
    if (!(await dirExists(tlDir))) continue;

    // Node files are `NN-<id>.md` (agent nodes) OR `NN-<id>.ts` (code nodes), sorted together so
    // the NN prefix drives DAG file order across both kinds. `index.md` is the tasklist header
    // (not a node); `.d.ts` is never a node.
    const files = await listDir(tlDir);
    const nodeFiles = files
      .filter((f) => (f.endsWith('.md') && f !== 'index.md') || (f.endsWith('.ts') && !f.endsWith('.d.ts')))
      .sort()
      .map((f) => join(tlDir, f));

    const tasklist: TasklistDir = { slug, files: nodeFiles };

    const indexPath = join(tlDir, 'index.md');
    if (await fileExists(indexPath)) {
      const raw = await readFile(indexPath, 'utf8');
      const { data, body } = parseFrontmatter(raw, indexPath);
      if (body) tasklist.description = body;
      if (data['input'] && typeof data['input'] === 'object' && !Array.isArray(data['input'])) {
        const input: Record<string, string> = {};
        for (const [k, v] of Object.entries(data['input'] as Record<string, unknown>)) input[k] = String(v);
        tasklist.input = input;
      }
      if (Array.isArray(data['connections'])) tasklist.connections = data['connections'].map(String);
    }

    result[slug] = tasklist;
  }

  return result;
}

/**
 * Allowed top-level keys in an agent `instruct.md` frontmatter block. Fail-loud gate: a key
 * outside this set is an authoring error — most importantly a typo'd `capabilities`/
 * `canDelegateTo` would otherwise be silently ignored, granting nothing. Byte-identical across all
 * three prior implementations (Part A1 §1 — the one area with no diff to resolve).
 */
const AGENT_FRONTMATTER_ALLOWED_KEYS = new Set([
  'title',
  'knowledge',
  'functions',
  'components',
  'actions',
  'defaultAction',
  'canDelegateTo',
  'dependencies',
  'capabilities',
  'model',
  'triggers',
]);

/** URL-safe webhook path pattern. */
const WEBHOOK_PATH_RE = /^[A-Za-z0-9_-]+$/;

async function loadAgent(
  agentsDir: string,
  slug: string,
  onWarn: (message: string) => void,
  knownTables?: string[],
): Promise<AgentDef> {
  const agentDir = join(agentsDir, slug);

  const instructPath = join(agentDir, 'instruct.md');
  let instructBody = '';
  let charterBody = '';
  let title = slug;
  const actions: ActionDef[] = [];
  const config: AgentConfig = { knowledge: [], functions: [], components: [] };
  let canDelegateTo: string[] | undefined;
  let defaultAction: string | undefined;
  let model: string | undefined;
  let capabilities: AgentDef['capabilities'] = {};
  let triggers: WebhookTrigger[] | undefined;

  if (await fileExists(instructPath)) {
    const raw = await readFile(instructPath, 'utf8');
    const { data, body } = parseFrontmatter(raw, instructPath);
    instructBody = body;

    const unknownKeys = Object.keys(data).filter((k) => !AGENT_FRONTMATTER_ALLOWED_KEYS.has(k));
    if (unknownKeys.length > 0) {
      throw new Error(
        `Agent "${slug}" (${instructPath}) has disallowed frontmatter key(s): ${unknownKeys.join(', ')}. Allowed keys: ${[...AGENT_FRONTMATTER_ALLOWED_KEYS].join(', ')}`,
      );
    }

    capabilities = parseCapabilities(data['capabilities'], { agentId: slug, knownTables });

    if (typeof data['title'] === 'string') title = data['title'];
    if (typeof data['defaultAction'] === 'string') defaultAction = data['defaultAction'];
    if (typeof data['model'] === 'string' && data['model'].trim()) model = data['model'].trim();
    if (Array.isArray(data['knowledge'])) config.knowledge = data['knowledge'].map(String);
    if (Array.isArray(data['functions'])) config.functions = data['functions'].map(String);
    if (Array.isArray(data['components'])) config.components = data['components'].map(String);
    if (Array.isArray(data['canDelegateTo'])) {
      canDelegateTo = data['canDelegateTo'].map(String);
    } else if (Array.isArray(data['dependencies'])) {
      canDelegateTo = data['dependencies'].map(String);
    }

    const instructProse = instructBody.replace(/```[\s\S]*?```/g, '');
    if (canDelegateTo && canDelegateTo.length === 0 && instructProse.includes('delegate(')) {
      onWarn(
        `agent "${slug}" (${instructPath}): canDelegateTo: [] means no delegation, but the instruct body calls delegate() — use ["*"] or an explicit allowlist if this agent should delegate`,
      );
    }

    if (Array.isArray(data['actions'])) {
      for (const action of data['actions'] as unknown[]) {
        if (typeof action === 'object' && action !== null) {
          const a = action as Record<string, unknown>;
          actions.push({
            id: String(a['id'] ?? ''),
            label: String(a['label'] ?? ''),
            description: String(a['description'] ?? ''),
            tasklist: String(a['tasklist'] ?? ''),
          });
        }
      }
    }

    if (data['triggers'] !== undefined) {
      if (!Array.isArray(data['triggers'])) {
        throw new Error(`Agent "${slug}" (${instructPath}) has a "triggers" frontmatter key that is not an array`);
      }
      triggers = data['triggers'].map((entry) => {
        if (typeof entry !== 'object' || entry === null) {
          throw new Error(`Agent "${slug}" (${instructPath}) has a malformed "triggers" entry: expected an object with a "webhook" key`);
        }
        const e = entry as Record<string, unknown>;
        const webhook = e['webhook'];
        if (typeof webhook !== 'object' || webhook === null) {
          throw new Error(`Agent "${slug}" (${instructPath}) has a malformed "triggers" entry: expected \`webhook: { path, provider? }\``);
        }
        const w = webhook as Record<string, unknown>;
        if (typeof w['path'] !== 'string' || w['path'].length === 0) {
          throw new Error(`Agent "${slug}" (${instructPath}) has a "triggers" entry with a missing or empty webhook.path`);
        }
        if (!WEBHOOK_PATH_RE.test(w['path'])) {
          throw new Error(`Agent "${slug}" (${instructPath}) has a "triggers" entry with an invalid webhook.path "${w['path']}" (expected URL-safe: letters, digits, '_', '-')`);
        }
        if (w['provider'] !== undefined && typeof w['provider'] !== 'string') {
          throw new Error(`Agent "${slug}" (${instructPath}) has a "triggers" entry with a non-string webhook.provider`);
        }
        return { path: w['path'], ...(typeof w['provider'] === 'string' ? { provider: w['provider'] } : {}) };
      });
    }
  }

  const charterPath = join(agentDir, 'charter.md');
  if (await fileExists(charterPath)) {
    const raw = await readFile(charterPath, 'utf8');
    const { body } = parseFrontmatter(raw, charterPath);
    charterBody = body.trim();
  }

  return {
    slug,
    title,
    instructBody,
    charterBody,
    actions,
    canDelegateTo,
    config,
    defaultAction,
    capabilities,
    ...(model ? { model } : {}),
    ...(triggers ? { triggers } : {}),
  };
}

/**
 * Load a space directory into an in-memory {@link Space} record. Fail-loud, synchronous
 * validation graph: every cross-reference (`functions:`, `components:`, `knowledge:`,
 * `actions[].tasklist`) is resolved and checked once, against the sibling directories of the same
 * space. Throws on the first problem found (core/dsh's behavior, unchanged from the prior port —
 * every existing `@lmthing/dsh-space-*` consumer is written and tested against this).
 */
export async function loadSpace(dir: string, opts: LoadSpaceOpts = {}): Promise<Space> {
  const requireAgents = opts.requireAgents ?? true;
  const onWarn = opts.onWarn ?? ((message: string) => console.warn(`[space-format] ${message}`));
  const agentsDir = join(dir, 'agents');
  const hasAgentsDir = await dirExists(agentsDir);

  if (!hasAgentsDir && requireAgents) {
    throw new Error(`Space at "${dir}" must have an agents/ directory`);
  }

  const agentSlugs = hasAgentsDir ? await listDirSorted(agentsDir) : [];
  const agentDirs: string[] = [];
  for (const slug of agentSlugs) {
    if (await dirExists(join(agentsDir, slug))) agentDirs.push(slug);
  }

  if (agentDirs.length === 0 && requireAgents) {
    throw new Error(`Space at "${dir}" must have at least one agent`);
  }

  let packageName: string | undefined;
  const pkgJsonPath = join(dir, 'package.json');
  if (await fileExists(pkgJsonPath)) {
    const pkgData = JSON.parse(await readFile(pkgJsonPath, 'utf8')) as Record<string, unknown>;
    if (typeof pkgData['name'] === 'string') packageName = pkgData['name'];
  }

  const agents: Record<string, AgentDef> = {};
  for (const slug of agentDirs) {
    agents[slug] = await loadAgent(agentsDir, slug, onWarn, opts.knownTables);
  }

  const tasklists = await loadTasklists(dir);

  for (const agent of Object.values(agents)) {
    for (const action of agent.actions) {
      if (action.tasklist && !(action.tasklist in tasklists)) {
        throw new Error(`Agent "${agent.slug}" action "${action.id}" references tasklist "${action.tasklist}" which does not exist`);
      }
    }
  }

  const functions = await loadFunctionsFromDir(dir);
  const components = await loadComponents(dir);
  const knowledge = await loadKnowledge(dir);

  for (const agent of Object.values(agents)) {
    for (const fnName of agent.config.functions) {
      if (!(fnName in functions)) {
        throw new Error(`Agent "${agent.slug}" requires function "${fnName}" but it was not found in functions/`);
      }
    }
    for (const compName of agent.config.components) {
      if (!(compName in components.view) && !(compName in components.form)) {
        throw new Error(`Agent "${agent.slug}" requires component "${compName}" but it was not found in components/view or components/form`);
      }
    }
    for (const knowledgeRef of agent.config.knowledge) {
      const [domainSlug, fieldSlug, optionSlug] = knowledgeRef.split('/');
      const domain = domainSlug ? knowledge.domains[domainSlug] : undefined;
      if (!domain) {
        throw new Error(`Agent "${agent.slug}" references knowledge "${knowledgeRef}" but domain "${domainSlug}" was not found in knowledge/`);
      }
      const field = fieldSlug ? domain.fields[fieldSlug] : undefined;
      if (fieldSlug && !field) {
        throw new Error(`Agent "${agent.slug}" references knowledge "${knowledgeRef}" but field "${fieldSlug}" was not found in domain "${domainSlug}"`);
      }
      if (optionSlug && field && !(optionSlug in field.options)) {
        throw new Error(`Agent "${agent.slug}" references knowledge "${knowledgeRef}" but option "${optionSlug}" was not found in field "${fieldSlug}" of domain "${domainSlug}"`);
      }
    }
  }

  return { dir, packageName, agents, tasklists, functions, components, knowledge };
}
