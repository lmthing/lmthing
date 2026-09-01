import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSpace, writeTasklistNode } from '../src/format/write.ts';

/**
 * The authoring writers validate by re-parse before committing. These cover the DAG writer's
 * edges: the ENTRY node (no `dependsOn` — optional at the boundary, once a raw TypeError),
 * dependency wiring, and the refusal of unknown deps and cycles with the partial file removed.
 */
const cleanup: string[] = [];
afterEach(async () => { while (cleanup.length) await rm(cleanup.pop()!, { recursive: true, force: true }); });

async function scratchSpace(): Promise<{ spacesDir: string; space: string }> {
  const root = await mkdtemp(join(tmpdir(), 'mcp-write-')); cleanup.push(root);
  const spacesDir = join(root, 'spaces');
  const created = await createSpace(spacesDir, 'demo', 'default');
  assert.equal(created.ok, true, JSON.stringify(created.ok ? [] : created.problems));
  return { spacesDir, space: 'demo' };
}
const target = async () => { const { spacesDir, space } = await scratchSpace(); return { dir: join(spacesDir, space), project: 'default' }; };

describe('writeTasklistNode', () => {
  test('an entry node with no dependsOn writes and parses — it is not a TypeError', async () => {
    const result = await writeTasklistNode(await target(), 'build', 'scaffold', { body: 'Scaffold the thing.', output: { id: 'string' } });
    assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.problems));
    const node = result.ok && result.space.tasklists.build!.nodes[0]!;
    assert.equal(node.id, 'scaffold');
    assert.deepEqual(node.dependsOn, []);
  });

  test('a second node wires its dependency and lands with the next NN- prefix', async () => {
    const into = await target();
    await writeTasklistNode(into, 'build', 'scaffold', { body: 'First.' });
    const result = await writeTasklistNode(into, 'build', 'assemble', { dependsOn: ['scaffold'], body: 'Then.' });
    assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.problems));
    const nodes = result.ok && result.space.tasklists.build!.nodes;
    assert.deepEqual(nodes.map((node) => node.id), ['scaffold', 'assemble']);
    assert.match(nodes[1]!.file, /02-assemble\.md$/);
  });

  test('an unknown dependsOn is refused with a problem naming the fault', async () => {
    const result = await writeTasklistNode(await target(), 'build', 'assemble', { dependsOn: ['ghost'], body: 'Then.' });
    assert.equal(result.ok, false);
    assert.match(JSON.stringify(result.problems), /unknown dependsOn target: ghost/);
  });

  test('a cycle is refused, and the refusing file leaves no partial state behind', async () => {
    const into = await target();
    await writeTasklistNode(into, 'build', 'one', { body: 'One.' });
    const result = await writeTasklistNode(into, 'build', 'two', { dependsOn: ['one'], body: 'Two.' });
    assert.equal(result.ok, true);
    const cyclic = await writeTasklistNode(into, 'build', 'one', { dependsOn: ['two'], body: 'One, rewritten into a cycle.' });
    assert.equal(cyclic.ok, false);
    assert.match(JSON.stringify(cyclic.problems), /cycle: /);
    // the on-disk `one` must still be the ORIGINAL: the write validated a temp candidate
    const reread = await writeTasklistNode(into, 'build', 'three', { dependsOn: ['one'], body: 'Three.' });
    assert.equal(reread.ok, true, JSON.stringify(reread.ok ? [] : reread.problems));
    const one = reread.ok && reread.space.tasklists.build!.nodes.find((node) => node.id === 'one');
    assert.equal(one!.body, 'One.', 'the refused cycle write must not have committed');
  });
});
