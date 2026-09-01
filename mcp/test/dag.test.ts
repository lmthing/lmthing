import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readyNodes, topoOrder, validateDag } from '../src/format/dag.ts';
import type { TasklistDag } from '../src/format/types.ts';

function dag(nodes: Array<[string, string[]]>): TasklistDag {
  return { slug: 'test', dir: '/test', nodes: nodes.map(([id, dependsOn]) => ({ id, file: `${id}.md`, body: '', dependsOn })) };
}

describe('tasklist DAG topology', () => {
  test('walks a diamond only after both parents finish', () => {
    const diamond = dag([['01', []], ['02', ['01']], ['03', ['01']], ['04', ['02', '03']]]);
    assert.deepEqual(readyNodes(diamond, ['01']), ['02', '03']);
    assert.deepEqual(readyNodes(diamond, ['01', '02']), ['03']);
    assert.deepEqual(readyNodes(diamond, ['01', '02', '03']), ['04']);
  });
  test('reports a cycle with its path', () => {
    assert.ok(validateDag(dag([['a', ['c']], ['b', ['a']], ['c', ['b']]])).some((problem) => problem.message === 'cycle: a -> c -> b -> a'));
  });
  test('returns a deterministic source-order topological ordering', () => {
    const graph = dag([['a', []], ['b', []], ['c', ['a']], ['d', ['b']]]);
    assert.deepEqual(topoOrder(graph), ['a', 'b', 'c', 'd']);
    assert.deepEqual(topoOrder(graph), ['a', 'b', 'c', 'd']);
  });
});
