/**
 * The END-TO-END gate: a real MCP client, over a real stdio transport, against the server
 * booted as an actual subprocess.
 *
 * This exists because the unit tests cannot see host wiring. They inject their own loader,
 * so all 20 of them passed green while the shipped server was handing every space function
 * an EMPTY schema — the CLI never passed an extractor to the loader, and nothing anywhere
 * reported it. Two more defects only visible from here: the whole `functions` tool group was
 * silently absent (a `.js` specifier in a tolerant dynamic import), and a failing space
 * function returned MCP `isError: false` with the failure buried in its payload.
 *
 * If you add a tool group, assert it here too.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// The runtime lives at the REPO root (`<repo>/.lmthing/<project>/spaces`) — the same layout a
// real user gets from `--root .`, which is what the repo's .mcp.json points at.
const repoRoot = join(pkgRoot, '..');
const spacesDir = join(repoRoot, '.lmthing', 'default', 'spaces');
let client: Client;

before(async () => {
  client = new Client({ name: 'live-gate', version: '0' }, { capabilities: {} });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    // Deliberately the LAUNCHER, not src/cli.ts — it is what .mcp.json actually runs, and
    // pointing at cli.ts once hid a bug where the launcher started nothing at all. And `--root`
    // rather than `--spaces-dir`, so this exercises the DEFAULT layout resolution
    // (<root>/.lmthing/default/spaces) that a real client gets, not an override path.
    args: [join(pkgRoot, 'bin', 'mcp-space.mjs'), '--root', repoRoot, '--agent', 'space-probe/probe'],
    cwd: pkgRoot,
    stderr: 'pipe',
  }));
});
after(async () => { await client?.close(); });

const names = async (): Promise<string[]> => (await client.listTools()).tools.map((t) => t.name);
async function call(name: string, args: Record<string, unknown> = {}): Promise<{ text: string; isError: boolean }> {
  const r = await client.callTool({ name, arguments: args }) as { isError?: boolean; content: { text: string }[] };
  return { text: r.content[0]!.text, isError: r.isError === true };
}
const json = async (n: string, a?: Record<string, unknown>): Promise<any> => JSON.parse((await call(n, a)).text);

test('every tool group is mounted', async () => {
  const t = await names();
  for (const n of ['list_spaces', 'set_agent',            // discovery
                   'list_functions', 'get_function_schema', // functions
                   'load_knowledge', 'search_knowledge',    // knowledge
                   'get_tasklist', 'next_tasklist_nodes',   // tasklists
                   'start_task', 'complete_task',           // tasklist run state
                   'list_delegates', 'export_claude_subagents', // delegation
                   'write_function', 'validate_space']) {   // authoring
    assert.ok(t.includes(n), `missing tool: ${n}`);
  }
});

test("the active agent's declared functions become tools", async () => {
  const t = await names();
  for (const n of ['addNumbers', 'greet', 'joinTags', 'pickTone', 'summarize', 'resolvedShape']) {
    assert.ok(t.includes(n), `missing space function tool: ${n}`);
  }
});

test('schemas are really extracted, not the empty fallback', async () => {
  const schema = await json('get_function_schema', { name: 'joinTags' });
  assert.equal(schema.properties.tags.type, 'array');
  assert.equal(schema.properties.tags.items.type, 'string', 'an array MUST carry items');
  assert.match(schema.properties.tags.description, /tag labels/, '@param text must reach the model');
  assert.deepEqual(schema.required, ['tags'], 'a defaulted param is optional');

  const byName = new Map<string, any>((await json('list_functions')).map((f: any) => [f.name, f]));
  assert.equal(byName.get('joinTags').verdict.kind, 'exact');
  assert.equal(byName.get('resolvedShape').verdict.kind, 'exact', 'an imported interface must RESOLVE');
  assert.equal(byName.get('explicitSchema').verdict.kind, 'explicit');
  const opaque = byName.get('opaqueShape').verdict;
  assert.equal(opaque.kind, 'degraded');
  assert.equal(opaque.param, 'callback', 'a degraded verdict must name the parameter');
  assert.ok(opaque.reason.length > 0);
});

test('invocation: real args, lossless JSON, and a failure that sets isError', async () => {
  assert.equal((await json('joinTags', { tags: ['a', 'b'], sep: '-' })).value, 'a-b');
  assert.equal((await json('summarize', { input: { title: 'T', body: 'B' } })).value, 'T: B');
  assert.equal((await json('returnsNothing')).value, null, 'undefined is not lossless JSON');
  const failed = await call('throwsError');
  assert.equal(failed.isError, true, 'a thrown space function must set MCP isError');
  assert.equal(JSON.parse(failed.text).error, 'probe failure');
});

test('knowledge and the tasklist DAG', async () => {
  assert.ok(JSON.stringify(await json('load_knowledge', { domain: 'probing', field: 'depth', option: 'deep' })).length > 20);
  assert.ok((await json('search_knowledge', { query: 'shallow' })).length > 0);
  assert.deepEqual(await json('next_tasklist_nodes', { slug: 'run_probe', completed: ['start'] }), ['inspect', 'expand']);
  assert.deepEqual(await json('next_tasklist_nodes', { slug: 'run_probe', completed: ['start', 'inspect'] }), ['expand']);
});

test('run state is stored programmatically, and a drifting harness is nudged', async () => {
  // The run file lives OUTSIDE spaces/ — runtime data, not format data — keyed per agent,
  // and every start/complete call re-reads it, so a reconnecting harness loses nothing.
  const file = join(repoRoot, '.lmthing', 'default', '.runs', 'space-probe', 'probe', 'run_probe.json');
  try {
    await rm(file, { force: true });
    await call('set_agent', { ref: 'space-probe/probe' });

    // DRIFT: completing a node that never started must be refused with the fix in the message.
    const drift = await call('complete_task', { slug: 'run_probe', id: 'start' });
    assert.equal(drift.isError, true, 'out-of-order completion must be salient, not a normal result');
    assert.match(drift.text, /no run state[\s\S]*Ready now: start/);

    // completed omitted → derived from the run once one exists: only the entry is ready.
    await call('start_task', { slug: 'run_probe' });
    assert.deepEqual(await json('next_tasklist_nodes', { slug: 'run_probe' }), ['start']);

    await call('start_task', { slug: 'run_probe', id: 'start' });
    const done = await json('complete_task', { slug: 'run_probe', id: 'start', output: { samples: [1] } });
    assert.deepEqual(done.next.map((entry: { id: string }) => entry.id), ['inspect', 'expand'], 'the diamond forks');
    assert.deepEqual(done.next[0].inputs.start, { samples: [1] }, 'ready entries carry recorded upstream outputs — the harness carries nothing');
    assert.match(await readFile(file, 'utf8'), /"status": "complete"/, 'state is really on disk');
  } finally {
    await call('set_agent', { ref: 'space-probe/probe' });
    await rm(file, { force: true });
  }
});

test('discovery sees both spaces, and delegation resolves the allowlist', async () => {
  const spaces = await json('list_spaces');
  assert.ok(spaces.length >= 2, 'the fixtures plus whatever authored spaces exist');
  assert.ok(spaces.some((space: { id: string }) => space.id === 'format-guide'), 'the format-guide space is discovered');
  assert.match(JSON.stringify(await json('list_delegates')), /helper/);
  assert.ok((await client.listPrompts()).prompts.length >= 6, 'one prompt per agent — grows with the corpus');
  assert.ok((await client.listResources()).resources.length > 0);
});

test('set_agent changes the tool list over a live session', async () => {
  const before = await names();
  await call('set_agent', { ref: 'space-probe/minimal' });
  const after = await names();
  assert.ok(before.includes('joinTags'));
  assert.ok(!after.includes('joinTags'), 'an agent declaring no functions must expose none');
  await call('set_agent', { ref: 'space-probe/probe' });
  assert.ok((await names()).includes('joinTags'), 'and switching back restores them');
});

test('a write does not degrade schemas: the authoring round trip end to end', async () => {
  // The gate that was missing. Every writer calls ctx.reload(), and reload() had its own
  // loader call site that forgot the extractor — so the FIRST authoring write silently
  // collapsed every schema in the server to `{properties:{}}`, permanently and with no error.
  // Anything that writes and then re-reads a schema catches it; nothing else does.
  const id = `space-writegate-${process.pid}`;
  const created = await json('create_space', { id });
  assert.equal(created.ok, true);
  try {
    const written = await json('write_function', {
      space: id, name: 'addTwo',
      source: '/**\n * Add two numbers.\n * @param a First.\n * @param b Second.\n */\nexport function addTwo(a: number, b: number): number { return a + b; }\n',
    });
    assert.equal(written.ok, true);
    assert.equal(written.schema.properties.a.type, 'number', 'write_function must hand back the derived schema');
    assert.equal(written.space.id, id);
    assert.ok(!written.space.functions[0].file.startsWith('/tmp/'), 'function paths must be real');

    await json('write_agent', {
      space: id, slug: 'agent',
      frontmatter: { title: 'Write Gate', functions: ['addTwo'], canDelegateTo: [] },
      instruct: 'Use addTwo.',
    });

    // AFTER two writes (so two reloads), the schema must still be extracted, not degraded.
    await call('set_agent', { ref: `${id}/agent` });
    const fns = await json('list_functions');
    const added = fns.find((f: any) => f.name === 'addTwo');
    assert.ok(added, 'the newly authored function must be declared and resolved');
    assert.equal(added.verdict.kind, 'exact', 'a reload must NOT drop the extractor');
    assert.equal(added.schema.properties.b.type, 'number');
    assert.ok((await names()).includes('addTwo'), 'and it must surface as a live MCP tool');
  } finally {
    await call('set_agent', { ref: 'space-probe/probe' });
    await rm(join(spacesDir, id), { recursive: true, force: true });
  }
});

test('exported subagents use MCP-qualified tool names', async () => {
  // Claude Code >= 2.1.208 REFUSES to launch a subagent naming a tool it cannot resolve, so a
  // bare space-function name like `greet` is not merely narrow — it is fatal. The correct name
  // is `mcp__<server>__greet`, and <server> is the key the CLIENT chose in its .mcp.json, which
  // this server cannot know: hence the serverName parameter.
  const outDir = join(pkgRoot, 'test', 'tmp-subagents');
  try {
    await call('set_agent', { ref: 'space-probe/probe' });     // canDelegateTo: [helper]
    const res = await json('export_claude_subagents', { outDir, serverName: 'space' });
    assert.equal(res.refused.length, 0);
    assert.equal(res.written.length, 1, 'must respect the allowlist, not export every agent');
    const body = await readFile(res.written[0], 'utf8');
    assert.match(body, /^generated-by: lmthing-mcp-space$/m, 'the anti-clobber marker must be present');
    assert.match(body, /^name: space-probe-helper$/m);
    assert.match(body, /^ {2}- mcp__space__greet$/m, 'tool names must be MCP-qualified');
    assert.doesNotMatch(body, /^ {2}- greet$/m, 'a bare function name is fatal to the subagent');

    const custom = await json('export_claude_subagents', { outDir, serverName: 'lm-spaces' });
    assert.match(await readFile(custom.written[0], 'utf8'), /^ {2}- mcp__lm-spaces__greet$/m);

    // A delegate declaring no functions must INHERIT rather than get an empty list, which
    // would leave it with no tools at all.
    await call('set_agent', { ref: 'space-probe/open' });        // omitted => unrestricted
    const wide = await json('export_claude_subagents', { outDir, serverName: 'space' });
    const minimalFile = wide.written.find((f: string) => f.endsWith('space-probe-minimal.md'));
    assert.ok(minimalFile);
    assert.doesNotMatch(await readFile(minimalFile, 'utf8'), /^tools:/m);
  } finally {
    await call('set_agent', { ref: 'space-probe/probe' });
    await rm(outDir, { recursive: true, force: true });
  }
});
