import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpace, loadSpaces } from '../src/format/load.ts';

// The real layout: <repoRoot>/.lmthing/<project>/spaces/ — anchored to the TEST FILE, not the
// process cwd, so the suite runs identically from anywhere.
const spaces = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.lmthing', 'default', 'spaces');
const cleanup: string[] = [];
async function scratch(): Promise<string> { const dir = await mkdtemp(join(tmpdir(), 'mcp-space-')); cleanup.push(dir); return dir; }
async function agent(root: string, frontmatter: string): Promise<void> {
  await mkdir(join(root, 'agents', 'one'), { recursive: true });
  await writeFile(join(root, 'agents', 'one', 'instruct.md'), `---\n${frontmatter}\n---\nInstructions.\n`);
}
afterEach(async () => { await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe('space format loader', () => {
  test('loads both authored fixture spaces and the complete probe surface', async () => {
    const all = await loadSpaces(spaces);
    assert.deepEqual(all.map((space) => space.id), ['space-mini', 'space-probe']);
    assert.equal((all[0]!.manifest as { name: string }).name, 'space-mini');
    const probe = all[1]!;
    assert.equal((probe.manifest as { name: string }).name, 'space-probe');
    assert.deepEqual(probe.functions.map((fn) => fn.name).sort(), ['addNumbers', 'explicitSchema', 'greet', 'joinTags', 'nestedShape', 'opaqueShape', 'pickTone', 'resolvedShape', 'returnsNothing', 'summarize', 'throwsError']);
    assert.ok(probe.functions.every((fn) => fn.verdict.kind === 'degraded'));
    assert.deepEqual(probe.knowledge[0]!.fields.map((field) => field.ref), ['probing/depth', 'probing/style']);
    assert.deepEqual(probe.knowledge[0]!.fields[0]!.options.map((option) => option.name), ['deep', 'shallow']);
    const dag = probe.tasklists.run_probe!;
    assert.match(dag.goal!, /diamond-shaped/);
    assert.deepEqual(dag.nodes.map((node) => node.id), ['start', 'inspect', 'expand', 'report']);
    assert.deepEqual(dag.nodes.find((node) => node.id === 'report')!.dependsOn, ['inspect', 'expand']);
    assert.equal(dag.nodes.find((node) => node.id === 'inspect')!.condition, 'start.samples != null');
    assert.equal(dag.nodes.find((node) => node.id === 'expand')!.forEach, 'start.samples');
    assert.equal(probe.agents.find((item) => item.slug === 'probe')!.actions[0]!.id, 'run-probe');
  });

  test('keeps delegation omitted, empty, wildcard, and allowlisted distinct', async () => {
    const space = await loadSpace(join(spaces, 'space-probe'));
    assert.deepEqual(space.agents.find((item) => item.slug === 'probe')!.canDelegateTo, ['space-probe/helper']);
    assert.deepEqual(space.agents.find((item) => item.slug === 'helper')!.canDelegateTo, []);
    assert.equal(space.agents.find((item) => item.slug === 'open')!.canDelegateTo, undefined);
    const root = await scratch(); await agent(root, 'canDelegateTo: ["*"]');
    assert.deepEqual((await loadSpace(root)).agents[0]!.canDelegateTo, ['*']);
  });

  test('fails loudly with every independent frontmatter problem', async () => {
    const root = await scratch();
    await agent(root, "capabilities: ['not:a:capability']\nmisspelled: true\nfunctions: nope");
    await assert.rejects(loadSpace(root), (error: unknown) => {
      assert.equal((error as { name?: string }).name, 'SpaceFormatError');
      const messages = (error as { problems: { message: string }[] }).problems.map((problem) => problem.message).join('\n');
      assert.match(messages, /unknown capability/);
      assert.match(messages, /disallowed frontmatter/);
      assert.match(messages, /must be a list of strings/);
      return true;
    });
  });

  test('surfaces tasklist TypeScript nodes as unsupported', async () => {
    const root = await scratch(); await agent(root, 'functions: []');
    await mkdir(join(root, 'tasklists', 'work'), { recursive: true });
    await writeFile(join(root, 'tasklists', 'work', '01-old.ts'), 'export async function run() {}');
    const space = await loadSpace(root);
    assert.equal(space.manifest, null);
    assert.ok(space.unsupported.some((item) => item.path === 'tasklists/work/01-old.ts'));
  });
});
