import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { invokeFn } from '../src/exec/invoke.ts';
import type { SpaceFn } from '../src/format/types.ts';

const functions = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tmp', 'exec-space', 'functions');
function fn(name: string): SpaceFn {
  return { name, file: path.join(functions, `${name}.ts`), description: '', schema: { type: 'object', properties: {} }, order: [], verdict: { kind: 'exact' } };
}

describe('invokeFn', () => {
  it('turns an undefined return into JSON null', async () => {
    assert.deepEqual(await invokeFn(fn('nothing'), {}), { ok: true, value: null });
  });
  it('contains thrown errors rather than rejecting the process', async () => {
    const result = await invokeFn(fn('throws'), {});
    assert.equal(result.ok, false);
    assert.equal(result.error, 'fixture failure');
  });
  it('tags JSON-inexpressible values deterministically', async () => {
    assert.deepEqual(await invokeFn(fn('unusual'), {}), { ok: true, value: { big: { $type: 'bigint', value: '2' }, negativeZero: { $type: 'number', value: '-0' }, self: { $type: 'circular', path: '$' } } });
  });
});
