import { mkdir } from 'node:fs/promises'

/**
 * Pre-registers one fixed workspace at boot — see the package doc comment for why this is required
 * (not optional polish): dsh's own web client requires an active workspace before it will render a
 * composable chat session at all ("Choose a workspace to start"), and picking one interactively
 * calls `host.pickDirectory`/`listDirectory`, which are hard-pinned to loopback regardless of
 * `--trusted-host` (dsh's own deliberate security boundary — see dsh/PROGRESS.md Part B2). Proxied
 * through Envoy, those calls always 403 — found live, the hard way, in a real browser session
 * against production: no workspace could ever be created through the UI.
 *
 * `ctx.workspaceRegistry.create(path, title)` is documented as idempotent — "repeated calls for the
 * same canonical path return the existing entity without changing its title" — so calling this on
 * every boot is safe; it does not create a duplicate workspace each restart.
 */
export const name = 'lmthing-default-workspace'
export const inject = ['workspaceRegistry']

/** @param {{ path: string, title?: string }} config */
export async function apply(ctx, config) {
  await mkdir(config.path, { recursive: true })
  await ctx.workspaceRegistry.create(config.path, config.title ?? 'Personal')
}
