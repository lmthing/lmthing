import { jsx, jsxs } from 'react/jsx-runtime'
import * as React from 'react'
import { Component, useEffect, useState } from 'react'

// Handoff for the server-bundled per-component modules: `@lmthing/dsh-space-components` bundles
// each component with `react` shimmed to read this exact global (see that package's
// `src/bundle.js` doc comment) — set to the SAME React instance this client bundle itself obtained
// via the shell's `require('react')`, so a dynamically-loaded component shares Hooks/Context
// identity with the rest of the app rather than getting a second, incompatible React copy.
if (typeof globalThis !== 'undefined') globalThis.__LMTHING_REACT__ = React

/**
 * Client half of Part A4 (see dsh/PROGRESS.md): real component UI rendering for
 * `@lmthing/dsh-space-components`'s `display` tool. Registers into the keyed
 * `tool.call.toolview` slot (`@deepseek-ai/dsh-client-ui-tool`'s own extension point — see
 * that package's README, "Atomic Tool views") for the wire tool name `display`.
 *
 * The host tool (`@lmthing/dsh-space-components`) bundles each declared component into a real,
 * standalone browser ES module SERVER-SIDE (esbuild, `react`/`react-dom` marked external) and
 * threads it to the client via `output.presentationMeta` → `ToolResult.meta` → here as
 * `block.meta.code` (base64). This component's only job is `import()`ing that real module — a
 * genuine ES module load through the browser's own loader, never `eval`/`new Function` — and
 * rendering its default export with the call's own props. No space-authored source is ever
 * evaluated by hand in the browser.
 */

/** A settled call carries `kind: 'tool-result'`; a running one does not — same discriminant
 *  `@deepseek-ai/dsh-client-ui-skill`'s own SkillRow uses for the identical union. */
function isSettled(block) {
  return 'kind' in block
}

/** The model's raw JSON args string, present on both running and settled call shapes. */
function argsRawOf(block) {
  return (isSettled(block) ? block.call?.argsRaw : block.argsRaw) ?? ''
}

/** Best-effort optimistic component name while the call is still running (no `meta` yet — that
 *  only lands with the settled result). Never throws: malformed JSON just yields no name. */
function optimisticComponentName(argsRaw) {
  try {
    const parsed = JSON.parse(argsRaw)
    return typeof parsed === 'object' && parsed !== null && typeof parsed.component === 'string'
      ? parsed.component
      : null
  } catch {
    return null
  }
}

/**
 * Class component: hooks cannot catch render errors thrown by a dynamically imported,
 * space-authored component, so a real error boundary is required here — a broken component must
 * degrade to an inline message, never take down the rest of the chat transcript.
 */
class DisplayErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return jsx('div', {
        'data-lmthing-display-error': true,
        style: { border: '1px solid #c00', borderRadius: 6, padding: 8, color: '#c00', fontSize: 13 },
        children: `display "${this.props.component}" failed to render: ${this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}`,
      })
    }
    return this.props.children
  }
}

/** Loads and renders the real bundled component from a base64 ES module — the one dynamic
 *  `import()` this whole package exists to perform. */
function LiveComponent({ code, componentProps }) {
  const [state, setState] = useState({ Comp: null, error: null })

  useEffect(() => {
    let cancelled = false
    import(/* webpackIgnore: true */ `data:text/javascript;base64,${code}`)
      .then((mod) => {
        if (cancelled) return
        const Comp = mod.default ?? mod
        if (typeof Comp !== 'function') throw new Error('bundle has no usable default export')
        setState({ Comp, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ Comp: null, error })
      })
    return () => {
      cancelled = true
    }
  }, [code])

  if (state.error) {
    return jsx('div', {
      style: { fontSize: 13, opacity: 0.75 },
      children: `component failed to load: ${state.error instanceof Error ? state.error.message : String(state.error)}`,
    })
  }
  if (!state.Comp) {
    return jsx('div', { style: { fontSize: 13, opacity: 0.6 }, children: 'loading component…' })
  }
  const Comp = state.Comp
  return jsx(Comp, { ...componentProps })
}

/** Fallback for a call with no usable bundle (bundling failed server-side, or the call hasn't
 *  settled yet) — the same information the generic card would have shown, so nothing is lost. */
function FallbackCard({ component, props, note }) {
  return jsxs('div', {
    style: { border: '1px solid var(--dsw-alias-border-l2, #ddd)', borderRadius: 8, padding: 8, fontSize: 13 },
    children: [
      jsx('div', { style: { fontWeight: 600 }, children: `display ${component ?? ''}` }),
      note ? jsx('div', { style: { opacity: 0.7, marginTop: 2 }, children: note }) : null,
      props ? jsx('pre', { style: { margin: '4px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }, children: JSON.stringify(props, null, 2) }) : null,
    ],
  })
}

/** The registered `tool.call.toolview` component itself — `ToolCallOwnerProps`. */
function DisplayToolView({ block }) {
  const settled = isSettled(block)

  if (!settled) {
    const component = optimisticComponentName(argsRawOf(block))
    return jsx(FallbackCard, { component, props: null, note: 'running…' })
  }

  const meta = block.meta
  const hasCode = meta && typeof meta === 'object' && typeof meta.code === 'string'
  if (!hasCode) {
    // No bundle (esbuild failed server-side, or a legacy/older display call with no
    // presentationMeta at all) — degrade to the same info the generic card already carried.
    const fallbackProps = meta && typeof meta === 'object' ? meta.props : undefined
    const fallbackComponent = meta && typeof meta === 'object' ? meta.component : optimisticComponentName(argsRawOf(block))
    return jsx(FallbackCard, { component: fallbackComponent, props: fallbackProps ?? null, note: null })
  }

  return jsx(DisplayErrorBoundary, {
    component: meta.component,
    children: jsx(LiveComponent, { code: meta.code, componentProps: meta.props ?? {} }),
  })
}

export const name = 'lmthing-client-space-components'
export const inject = ['slots']

export function apply(ctx) {
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'display' }, DisplayToolView))
}
