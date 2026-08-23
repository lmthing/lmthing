import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateCondition, referencedTaskIds } from '../src/condition-dsl.js'

/**
 * Port-verification for the DSL, whose grammar is fully specified by the
 * original's own comment (sdk/org/libs/core/src/tasklist/condition-dsl.ts):
 *
 *   expr    = clause (WS* ("AND"|"OR") WS* clause)*
 *   clause  = path WS+ op WS+ literal
 *   op      = "==" | "!=" | ">" | "<" | ">=" | "<="
 */

const OUTPUTS = {
  classify: { target: 'db', operation: 'update', score: 7, ok: false, missing: null },
  locate: { status: 'confirmed' },
}

test('all six operators evaluate against a dotted path', () => {
  assert.equal(evaluateCondition('classify.target == "db"', OUTPUTS), true)
  assert.equal(evaluateCondition('classify.target != "db"', OUTPUTS), false)
  assert.equal(evaluateCondition('classify.score > 6', OUTPUTS), true)
  assert.equal(evaluateCondition('classify.score < 6', OUTPUTS), false)
  assert.equal(evaluateCondition('classify.score >= 7', OUTPUTS), true)
  assert.equal(evaluateCondition('classify.score <= 6', OUTPUTS), false)
})

test('AND/OR sequence left to right with no precedence', () => {
  assert.equal(evaluateCondition('classify.target == "db" AND locate.status == "confirmed"', OUTPUTS), true)
  assert.equal(evaluateCondition('classify.target == "db" AND locate.status == "none"', OUTPUTS), false)
  assert.equal(evaluateCondition('classify.target == "space" OR locate.status == "confirmed"', OUTPUTS), true)
  // Left-to-right, so (false OR true) AND false === false — NOT (false OR (true AND false)).
  assert.equal(
    evaluateCondition('classify.target == "space" OR locate.status == "confirmed" AND classify.ok == true', OUTPUTS),
    false,
  )
})

test('booleans, numbers and null parse as literals, not strings', () => {
  assert.equal(evaluateCondition('classify.ok == false', OUTPUTS), true)
  assert.equal(evaluateCondition('classify.ok == "false"', OUTPUTS), false)
  assert.equal(evaluateCondition('classify.score == 7', OUTPUTS), true)
  assert.equal(evaluateCondition('classify.score == "7"', OUTPUTS), false)
})

test('nullish equality treats null and a missing path as the same thing', () => {
  assert.equal(evaluateCondition('classify.missing == null', OUTPUTS), true)
  assert.equal(evaluateCondition('classify.neverSet == null', OUTPUTS), true)
  assert.equal(evaluateCondition('classify.neverSet != null', OUTPUTS), false)
  // A missing path is never equal to a real value.
  assert.equal(evaluateCondition('classify.neverSet == "db"', OUTPUTS), false)
})

test('an empty expression is vacuously true', () => {
  assert.equal(evaluateCondition('', OUTPUTS), true)
})

test('an unparseable clause throws rather than silently passing', () => {
  assert.throws(() => evaluateCondition('classify.target', OUTPUTS), /Cannot parse condition clause/)
})

test('referencedTaskIds extracts every top-level id of a multi-clause expression', () => {
  assert.deepEqual(
    referencedTaskIds('classify.target == "db" AND locate.status == "confirmed"').sort(),
    ['classify', 'locate'],
  )
})

test('referencedTaskIds de-duplicates repeated references and keeps a bare id', () => {
  assert.deepEqual(referencedTaskIds('a.x == 1 OR a.y == 2'), ['a'])
  assert.deepEqual(referencedTaskIds('gate == true'), ['gate'])
})
