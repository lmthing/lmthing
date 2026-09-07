import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundleComponent } from '../src/bundle.js'

const WITH_DEFAULT = `
import React from 'react'
export function Card({ title }) {
  return React.createElement('div', null, title)
}
export default Card
`

const NAMED_ONLY = `
import React from 'react'
export function Card({ title }) {
  return React.createElement('div', null, title)
}
`

test('bundleComponent: a component with an existing default export bundles unmodified', async () => {
  const b64 = await bundleComponent('Card', WITH_DEFAULT)
  const code = Buffer.from(b64, 'base64').toString('utf8')
  assert.match(code, /export\s*\{/)
  // Only ONE default export in the source — no appended second one.
  assert.equal((code.match(/as default/g) ?? []).length + (code.match(/^\s*export default/gm) ?? []).length, 1)
})

test('bundleComponent: a component with only a named export gets a default appended', async () => {
  const b64 = await bundleComponent('Card', NAMED_ONLY)
  const code = Buffer.from(b64, 'base64').toString('utf8')
  assert.match(code, /export\s*\{[\s\S]*default[\s\S]*\}/)
})

test('bundleComponent: react resolves through the globalThis shim, never bundling react\'s own runtime', async () => {
  const b64 = await bundleComponent('Card', WITH_DEFAULT)
  const code = Buffer.from(b64, 'base64').toString('utf8')
  // See the module doc comment: a bare `import ... from "react"` cannot resolve in this delivery
  // mechanism (no browser-native import map — confirmed by a real, live failure), so it's shimmed
  // to read `globalThis.__LMTHING_REACT__` instead of being left as an unresolvable external import.
  assert.match(code, /globalThis\.__LMTHING_REACT__/)
  assert.ok(!code.includes('from "react"'), 'a bare unresolvable "react" import must not survive into the bundle')
  // esbuild's own React shim/runtime source (e.g. "react.production.min") would appear if bundled.
  assert.ok(!code.includes('react.production'), 'react must not be inlined into the bundle')
})

test('bundleComponent: JSX transforms to real .createElement(...) calls (classic runtime), not raw JSX', async () => {
  const jsxSource = `
import React from 'react'
export default function Card({ title }) {
  return <div className="card">{title}</div>
}
`
  const b64 = await bundleComponent('Card', jsxSource)
  const code = Buffer.from(b64, 'base64').toString('utf8')
  // esbuild renames the bundled import binding (e.g. `react_default`), so this matches the call
  // shape rather than the literal identifier "React".
  assert.match(code, /\.createElement\(/)
  assert.ok(!code.includes('<div'), 'JSX syntax must not survive into the bundle')
})

test('bundleComponent: with globalThis.__LMTHING_REACT__ set, a react-using bundle imports and renders for real (the actual live fix, reproduced in Node)', async () => {
  // A minimal, dependency-free stand-in for the real React default export: just enough surface
  // (createElement) for the classic JSX runtime esbuild emits. Confirms the SAME mechanism proven
  // live in a real browser (chrome-devtools MCP, Part A4): the shimmed import reads this exact
  // global rather than trying to resolve a real "react" package.
  const fakeReact = {
    createElement: (type, props, ...children) => ({ type, props, children }),
  }
  globalThis.__LMTHING_REACT__ = fakeReact
  try {
    const b64 = await bundleComponent('Card', WITH_DEFAULT)
    const mod = await import(`data:text/javascript;base64,${b64}`)
    const element = mod.default({ title: 'hi' })
    assert.deepEqual(element, { type: 'div', props: null, children: ['hi'] })
  } finally {
    delete globalThis.__LMTHING_REACT__
  }
})

test('bundleComponent: without globalThis.__LMTHING_REACT__ set, the shim fails loud (never silently renders with no React)', async () => {
  delete globalThis.__LMTHING_REACT__
  // A source distinct from every other test's (not just WITH_DEFAULT) so the resulting data: URL
  // is genuinely new — Node caches ES modules by exact URL, and re-importing the SAME base64
  // string would silently return the already-evaluated module from an earlier test instead of
  // re-running this shim's top-level check.
  const source = `
import React from 'react'
export default function CardWithoutReactSet({ title }) {
  return React.createElement('span', null, title)
}
`
  const b64 = await bundleComponent('CardWithoutReactSet', source)
  await assert.rejects(() => import(`data:text/javascript;base64,${b64}`), /__LMTHING_REACT__ was not set/)
})

test('bundleComponent: a real syntax error throws, for the caller\'s fail-soft wrapper to catch', async () => {
  await assert.rejects(() => bundleComponent('Broken', 'export default function( {'))
})

test('bundleComponent: the resulting bundle is a real, importable ES module (round-trip via a data: URL)', async () => {
  // No `react` import here on purpose: this test runs in plain Node, which has no `react` package
  // to resolve — the browser shell supplies it at runtime (see the module doc comment), so this
  // checks only that the OUTPUT is a genuine, loader-importable ES module, not react-specific
  // behavior (covered separately above by inspecting the bundle text).
  const source = 'export default function Card({ title }) { return title }'
  const b64 = await bundleComponent('Card', source)
  const mod = await import(`data:text/javascript;base64,${b64}`)
  assert.equal(typeof mod.default, 'function')
  assert.equal(mod.default({ title: 'hi' }), 'hi')
})
