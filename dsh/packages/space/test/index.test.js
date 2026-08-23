import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as space from '../src/index.js'

test('exports a valid Cordis Plugin.Object shape', () => {
  assert.equal(typeof space.name, 'string')
  assert.equal(typeof space.apply, 'function')
})
