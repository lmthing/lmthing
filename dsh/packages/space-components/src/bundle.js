/**
 * Bundle one space-authored `components/{view,form}/<Name>.tsx` source into a real, standalone
 * browser ES module — Part A4 (see dsh/PROGRESS.md): server-side per-component bundling, so the
 * client never evaluates arbitrary space-authored source itself (no `eval`/`new Function` surface
 * in the browser — the client only ever does a real `import()` of a built ES module, exactly like
 * importing any other script).
 *
 * ## Why `react` is shimmed through `globalThis`, not left as a bare external import
 *
 * The naive approach — mark `react` `external` and leave `import React from "react"` in the
 * output — is WRONG for this delivery mechanism specifically, confirmed by a real, live failure:
 * dsh's web client is not a plain browser module graph with an import map. Its own module system
 * (`@deepseek-ai/dsh-client-modules`, "Lazy CJS model") resolves every package via a custom
 * `window.__ModuleLoader__` + synchronous `require()` inside a generated factory closure — there
 * is no browser-native resolution for a bare `"react"` specifier anywhere on the page, so a real
 * ES module `import()`ed from a `data:` URL (which has no import map of its own) gets
 * `Failed to resolve module specifier "react"`.
 *
 * The fix: `react` resolves to a tiny VIRTUAL module (an esbuild plugin's `onResolve`/`onLoad`)
 * that reads `globalThis.__LMTHING_REACT__` at IMPORT time. The client
 * (`@lmthing/dsh-client-space-components`) sets that global to the EXACT SAME React instance its
 * own bundle obtained via `require('react')` (the shell-seeded one) before ever importing a
 * component bundle — so the dynamically-loaded component shares Hooks/Context identity with the
 * rest of the app, the same guarantee `external` was originally meant to provide, just reached by
 * a mechanism that actually works with this shell's module system.
 *
 * `jsx: 'transform'` (esbuild's classic-runtime output, `React.createElement(...)`) is used
 * DELIBERATELY over the automatic runtime — it means only the single `react` specifier needs
 * shimming, not `react/jsx-runtime` as well, and every real component in this repo already uses
 * the classic `import React from 'react'` style.
 */
const REACT_SHIM_NAMESPACE = 'lmthing-react-shim'
const REACT_NAMED_EXPORTS = [
  'useState', 'useEffect', 'useLayoutEffect', 'useRef', 'useMemo', 'useCallback', 'useContext',
  'useReducer', 'useImperativeHandle', 'useDebugValue', 'useId', 'useSyncExternalStore',
  'useTransition', 'useDeferredValue', 'createContext', 'forwardRef', 'memo', 'lazy', 'Fragment',
  'StrictMode', 'Suspense', 'Component', 'PureComponent', 'createElement', 'cloneElement',
  'createRef', 'isValidElement', 'Children', 'version',
]

/** esbuild plugin: redirect the bare `react` import to a runtime shim reading
 *  `globalThis.__LMTHING_REACT__` — see the module doc comment for why. */
const reactGlobalShimPlugin = {
  name: 'lmthing-react-global-shim',
  setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: REACT_SHIM_NAMESPACE }))
    build.onLoad({ filter: /.*/, namespace: REACT_SHIM_NAMESPACE }, () => ({
      loader: 'js',
      contents: [
        'const __R = globalThis.__LMTHING_REACT__;',
        'if (!__R) throw new Error("@lmthing/dsh-client-space-components: globalThis.__LMTHING_REACT__ was not set before importing a component bundle");',
        'export default __R;',
        ...REACT_NAMED_EXPORTS.map((name) => `export const ${name} = __R.${name};`),
      ].join('\n'),
    }))
  },
}

/**
 * Real components in this repo use either `export default Foo` alone, or `export function Foo` +
 * `export default Foo`. The space-format spec doesn't require a default export, so a source with
 * no `export default` gets one appended, referencing the component's own declared name (a real,
 * valid JS identifier — `space-format` derives it from the filename, which `loadComponents`
 * already constrains to a safe basename). A source that already has `export default` is bundled
 * completely unmodified — appending a second one would be a duplicate-export syntax error.
 */
const EXPORT_DEFAULT_RE = /\bexport\s+default\b/

export async function bundleComponent(name, source) {
  const { build } = await import('esbuild')
  const hasDefault = EXPORT_DEFAULT_RE.test(source)
  const contents = hasDefault ? source : `${source}\nexport default ${name};\n`

  const result = await build({
    stdin: {
      contents,
      loader: 'tsx',
      resolveDir: process.cwd(),
      sourcefile: `${name}.tsx`,
    },
    bundle: true,
    format: 'esm',
    write: false,
    platform: 'browser',
    target: 'es2020',
    jsx: 'transform',
    plugins: [reactGlobalShimPlugin],
    external: ['react-dom', 'react-dom/client'],
    logLevel: 'silent',
  })

  const file = result.outputFiles?.[0]
  if (!file) throw new Error(`@lmthing/dsh-space-components: esbuild produced no output for component "${name}"`)
  return Buffer.from(file.contents).toString('base64')
}
