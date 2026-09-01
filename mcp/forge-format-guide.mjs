import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// this script lives at <repo>/mcp/forge-format-guide.mjs
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const client = new Client({ name: 'forger', version: '0' });
await client.connect(new StdioClientTransport({
  command: process.execPath,
  args: [join(repoRoot, 'mcp', 'bin', 'mcp-space.mjs'), '--root', repoRoot],
  cwd: join(repoRoot, 'mcp'), stderr: 'pipe',
}));
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  if (r.isError) throw new Error(`${name}: ${r.content[0].text}`);
  return JSON.parse(r.content[0].text);
};
const check = (label, r) => {
  if (!r.ok) { console.error(`FAIL ${label}:`, JSON.stringify(r.problems, null, 2)); process.exitCode = 1; }
  else console.log(`ok  ${label}`);
};

const SPACE = 'format-guide';

// 1. scaffold
check('create_space', await call('create_space', { id: SPACE }));

// 2. functions — pure helpers that serve authoring itself
check('write_function parseRef', await call('write_function', {
  space: SPACE, name: 'parseRef',
  source: [
    '/**',
    ' * Parse a fully qualified agent ref.',
    ' * @param ref The three-part ref, e.g. "default/space-probe/probe".',
    ' * @returns The parsed parts plus the normalized qualified form.',
    ' * @throws When the ref does not have exactly three non-empty parts.',
    ' */',
    'export function parseRef(ref: string): { project: string; space: string; slug: string; qualified: string } {',
    "  const parts = ref.split('/').filter((part) => part.length > 0);",
    "  if (parts.length !== 3) throw new Error(`agent ref must be <project>/<space>/<slug>, got: ${ref}`);",
    "  return { project: parts[0]!, space: parts[1]!, slug: parts[2]!, qualified: parts.join('/') };",
    '}',
  ].join('\n'),
}));
check('write_function checkDag', await call('write_function', {
  space: SPACE, name: 'checkDag',
  source: [
    '/**',
    ' * Static checks for a draft tasklist DAG: unknown dependsOn targets and dependency cycles.',
    ' * @param nodes Every node of the draft: its id and what it depends on.',
    ' * @returns ok=false with one problem string per fault; ok=true when the DAG is sound.',
    ' */',
    'export function checkDag(nodes: Array<{ id: string; dependsOn: string[] }>): { ok: boolean; problems: string[] } {',
    '  const problems: string[] = [];',
    '  const known = new Set(nodes.map((node) => node.id));',
    '  for (const node of nodes) {',
    "    for (const dep of node.dependsOn) if (!known.has(dep)) problems.push(`${node.id}: unknown dependsOn target ${dep}`);",
    '  }',
    '  const state = new Map<string, number>();',
    '  const byId = new Map(nodes.map((node) => [node.id, node]));',
    '  const stack: string[] = [];',
    '  const visit = (id: string): void => {',
    '    const mark = state.get(id);',
    "    if (mark === 0) { problems.push(`cycle: ${[...stack.slice(stack.indexOf(id)), id].join(' -> ')}`); return; }",
    '    if (mark === 1) return;',
    '    state.set(id, 0); stack.push(id);',
    '    for (const dep of byId.get(id)?.dependsOn ?? []) visit(dep);',
    '    stack.pop(); state.set(id, 1);',
    '  };',
    '  for (const node of nodes) visit(node.id);',
    '  return { ok: problems.length === 0, problems };',
    '}',
  ].join('\n'),
}));

// 3. knowledge — the format rules, one leaf per topic
const K = [
  ['agents', 'frontmatter',
    '## Agent frontmatter\n\n`instruct.md` opens with YAML frontmatter. Only ALLOW-LISTED keys parse: `title`, `functions`, `knowledge`, `capabilities`, `canDelegateTo` (deprecated alias `dependencies`), `actions`, `defaultAction`, `model`, `triggers`. An unlisted key FAILS THE LOAD on purpose — a typo like `capabilites:` must never silently grant nothing.\n\n`canDelegateTo` has four states: key omitted = unrestricted; `[]` = no delegates; `["*"]` = explicit wildcard; a list = allowlist. A two-part entry (`space/slug`) is PROJECT-LOCAL — it resolves inside the delegating agent\'s own project; a three-part ref (`project/space/slug`) crosses projects.\n\n`actions` entries are `{ id, label, description, tasklist }` and bind an agent to its tasklists.\n\n`capabilities` entries carry a grant id and optional config, e.g. `api:call: { allow: [\'*\'] }`.'],
  ['agents', 'files',
    '## Agent files\n\n`agents/<slug>/instruct.md` = frontmatter + body. The BODY is the agent\'s system prompt and is charged in full on every turn — keep it tight and push reference material into knowledge aspects loaded on demand. `charter.md` (optional) holds identity and mission, body only.\n\nAn agent ref is always three parts: `<project>/<space>/<slug>`.'],
  ['functions', 'extraction',
    '## Schema extraction\n\nA function\'s MCP inputSchema is DERIVED from its TypeScript signature and JSDoc — never hand-written: parameters become properties in order; `?` or a default makes them optional; each `@param` line becomes that property\'s description; the leading JSDoc paragraph becomes the tool description.\n\nAn array type MUST emit `items` — a bare `{ type: "array" }` gives a model nothing to aim at. Inline object types recurse; interfaces imported from sibling files resolve through the program.\n\nEvery function gets a verdict: `exact`, `degraded` (names the parameter that went opaque and why — fix the type rather than accept it), or `explicit` (an `export const schema` override; the escape hatch, not the path).'],
  ['functions', 'rules',
    '## Function rules\n\nA space function is PURE and self-contained: positional parameters in, return value out. There are no ambient globals — no `db`, `ask`, `display`, `emitEvent`; those died with the REPL runtime. `undefined` results are serialized as `null`; a thrown error becomes a tool error, never a crash.\n\nAuthor through `write_function`: it returns the DERIVED schema, so inspect it immediately — that object is exactly what the model will see.'],
  ['tasklists', 'dag',
    '## Tasklist format\n\n`tasklists/<slug>/index.md` holds `input:` (a `field: type` map) and the goal line. Each node is `NN-<id>.md` with frontmatter `id`, `dependsOn` (other node ids), optional `condition`, `forEach`, `role`, and `output:` — a `field: type` map of what completing the node hands downstream.\n\nThe graph must be acyclic and every `dependsOn` must name an existing node — both are checked at write time and at load.'],
  ['tasklists', 'running',
    '## Running a tasklist\n\nWalk a run with `start_task` and `complete_task` — run state is persisted per (project, space, agent, tasklist) under `.lmthing/<project>/.runs/`, so a reconnected harness asks the server where it is instead of remembering.\n\nOut-of-order calls are REFUSED with guidance naming what is ready now; restarting a finished node returns its recorded output instead of redoing work. Complete a node with its declared `output:` fields — downstream nodes receive them as `inputs`. `condition` and `forEach` are free text the driving model interprets against those inputs.'],
];
for (const [field, option, body] of K) {
  check(`write_knowledge format/${field}/${option}`, await call('write_knowledge', { space: SPACE, domain: 'format', field, option, body }));
}

// 4. the tasklist FIRST — write_agent validates that its actions' tasklist slugs exist, so the
// nodes must be authored before the agent that binds them. A comb: scaffold → {functions,
// knowledge} → agent → tasklist → validate.
const NODES = [
  ['scaffold', { output: { spaceId: 'string' } }, 'Create the target space with create_space (project `default` unless told otherwise). Every later step addresses it by ref `<project>/<id>`. Record the created space id as `spaceId`.'],
  ['functions', { dependsOn: ['scaffold'], output: { functions: 'array' } }, 'Author each pure function with write_function and inspect the returned schema: arrays must carry items; a degraded verdict names the parameter to fix — improve the type instead of accepting it. Record the function names as `functions`.'],
  ['knowledge', { dependsOn: ['scaffold'], output: { domains: 'array' } }, 'Author the knowledge tree with write_knowledge: `domain/field/option`, one topic per leaf, each leaf under one screen. Record the `domain/field` refs as `domains` — the agent in the next step will declare them.'],
  ['agent', { dependsOn: ['functions', 'knowledge'], output: { ref: 'string' } }, 'Write the agent with write_agent: frontmatter `functions` must name functions authored in this space, `knowledge` must list the domains just authored, `canDelegateTo` per its four states, and one `actions` entry per tasklist (id/label/description/tasklist). Record `<project>/<space>/<slug>` as `ref`.'],
  ['tasklist', { dependsOn: ['agent'], output: { slugs: 'array' } }, 'Author the tasklist with write_tasklist_node: one node per stage, `dependsOn` wiring the true order, `output:` declaring what each completion hands downstream. Run checkDag over the planned nodes BEFORE writing; unknown deps and cycles are refused. Record the slugs as `slugs`.'],
  ['validate', { dependsOn: ['tasklist'], role: 'general', output: { report: 'string' } }, 'Run validate_space and fix every reported problem. Then prove the space usable: set_agent to the new agent and walk its tasklist with start_task/complete_task from scaffold to a completed run. Record the outcome as `report`.'],
];
for (const [id, extra, body] of NODES) {
  check(`write_tasklist_node ${id}`, await call('write_tasklist_node', { space: SPACE, slug: 'author_a_space', id, node: { ...extra, body } }));
}

// 5. the agent — its actions bind the tasklist authored above
check('write_agent guide', await call('write_agent', {
  space: SPACE, slug: 'guide',
  frontmatter: {
    title: 'Format Guide',
    functions: ['parseRef', 'checkDag'],
    knowledge: ['format/agents', 'format/functions', 'format/tasklists'],
    canDelegateTo: [],
    actions: [{ id: 'author-a-space', label: 'Author a space', description: 'Walk the creation of a complete space: functions, knowledge, agent, tasklist, validation.', tasklist: 'author_a_space' }],
  },
  instruct: [
    'You guide the authoring of LMThing spaces — you know the format precisely and you build with it.',
    '',
    'Method, always in this order:',
    '1. Load the relevant knowledge aspect (`format/agents`, `format/functions`, `format/tasklists`) BEFORE writing that kind of artifact — the rules live there, not in memory.',
    '2. Author through the MCP tools only: `create_space`, `write_function`, `write_knowledge`, `write_agent`, `write_tasklist_node`. Every write is validated by re-parse before it commits; treat a returned `problems` list as the spec, not an obstacle.',
    '3. Check every `write_function` response schema: arrays must carry `items`, and a `degraded` verdict names the parameter to fix — never accept degradation silently.',
    '4. Validate refs with `parseRef` and draft DAGs with `checkDag` before writing nodes.',
    '5. Finish with `validate_space`, then prove the space USABLE, not just parseable: `set_agent` to the new agent and walk its tasklist with `start_task`/`complete_task`.',
    '',
    'Refs are three-part: `<project>/<space>/<slug>`. Addresses are cheap; ambiguity is not — qualify.',
  ].join('\n'),
  charter: 'The format, taught and applied: every space this agent helps create parses clean and runs end to end.',
}));

// 6. smoke the new tasklist, then leave no run state behind
await call('set_agent', { ref: `default/${SPACE}/guide` });
const standings = await call('start_task', { slug: 'author_a_space' });
console.log('tasklist ready:', JSON.stringify(standings.ready.map((entry) => entry.id)));
await rm(join(repoRoot, '.lmthing', 'default', '.runs', SPACE, 'guide', 'author_a_space.json'), { force: true });

const problems = await call('validate_space', { id: SPACE });
console.log('validate_space:', JSON.stringify(problems));
await client.close();
