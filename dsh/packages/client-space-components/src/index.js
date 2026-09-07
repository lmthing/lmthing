/**
 * Host half of Part A4's client rendering plugin — pure UI plugin, no host-side behavior. The
 * empty `apply` exists only so this package appears as a mounted row in the profile composition
 * (`cordis.yml`/`cordis.patch.yml`), which is what makes it an "enabled Loader entry" —
 * `@deepseek-ai/dsh-client-modules`' own Node half only serves `dsh.client` bundles for packages
 * that are actually mounted. The real behavior ships via `exports['./client']`
 * (`src/client.jsx`, built to `lib/client.js`), discovered through this package.json's own
 * `dsh.client` declaration. Exact same shape as `@deepseek-ai/dsh-client-ui-skill`'s own
 * `lib/index.js` — a real, shipped example of this identical pattern.
 */
export const name = 'lmthing-client-space-components'

export function apply() {}
