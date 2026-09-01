import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExtractor } from '../src/schema/derive.ts';

const functions = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tmp', 'schema-space', 'functions');
const extract = (name: string) => createExtractor(path.dirname(functions)).extract(path.join(functions, `${name}.ts`), name);

describe('createExtractor', () => {
  it('derives arrays with items and optional JSDoc parameters', async () => {
    assert.deepEqual((await extract('tags')).schema, { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' }, description: 'Labels.' } } });
  });
  it('recurses one and two levels through inline objects', async () => {
    assert.deepEqual((await extract('shape')).schema, { type: 'object', properties: { value: { type: 'object', properties: { title: { type: 'string' }, meta: { type: 'object', properties: { active: { type: 'boolean' } }, required: ['active'] } }, required: ['title', 'meta'] } }, required: ['value'] });
  });
  it('resolves a named interface imported from its sibling', async () => {
    assert.deepEqual((await extract('imported')).schema, { type: 'object', properties: { user: { type: 'object', properties: { id: { type: 'string' }, flags: { type: 'array', items: { type: 'number' } } }, required: ['id', 'flags'] } }, required: ['user'] });
  });
  it('labels opaque inputs in both property description and verdict', async () => {
    const fn = await extract('opaque');
    assert.deepEqual(fn.schema, { type: 'object', properties: { input: { type: 'object', description: 'Opaque input. Schema degraded: any or unknown cannot describe an input shape' } }, required: ['input'] });
    assert.deepEqual(fn.verdict, { kind: 'degraded', param: 'input', reason: 'any or unknown cannot describe an input shape' });
  });
  it('uses an explicit schema verbatim', async () => {
    const fn = await extract('explicit');
    assert.deepEqual(fn.schema, { type: 'object', properties: { count: { type: 'integer', minimum: 1 } }, required: ['count'], additionalProperties: false });
    assert.deepEqual(fn.verdict, { kind: 'explicit' });
  });
});
