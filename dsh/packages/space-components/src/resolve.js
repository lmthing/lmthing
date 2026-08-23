import { loadSpace } from '@lmthing/dsh-space-format'

/**
 * @typedef {Object} ResolvedComponent
 * @property {string} name        basename of the .tsx/.ts file, as declared in the agent's `components:` list
 * @property {'view'|'form'} kind which components/ subdirectory it came from
 * @property {string} source      the raw file text (space-format already read it)
 */

/**
 * Resolve every component agent `agentSlug` declares (`agent.config.components`)
 * against the space's `components.view` / `components.form` maps.
 *
 * `space-format`'s own `loadSpace` already cross-validates that each declared
 * name is present in ONE of the two maps (see its load.js), so the throw below
 * should be unreachable in practice — it exists for the case where this
 * resolver is handed hand-built input that bypassed `loadSpace`, and to keep the
 * failure legible instead of producing a component with `source: undefined`.
 *
 * Lookup order is `view` first, then `form`. LMThing's validation only requires
 * presence in EITHER, so a space declaring the same basename under both
 * directories is ambiguous at the format level; rather than silently picking
 * one, this warns and documents that `view` wins.
 *
 * @param {string} spaceDir
 * @param {string} agentSlug
 * @param {{ onWarn?: (message: string) => void }} [opts]
 * @returns {Promise<ResolvedComponent[]>}
 */
export async function resolveComponents(spaceDir, agentSlug, opts = {}) {
  const onWarn = opts.onWarn ?? ((message) => console.warn(`[space-components] ${message}`))
  const space = await loadSpace(spaceDir)
  return resolveComponentsFromSpace(space, agentSlug, { onWarn })
}

/**
 * The pure half of {@link resolveComponents} — same logic against an
 * already-loaded `Space`. Kept exported so a caller that already holds a space
 * (or a test exercising the defensive not-found path with hand-built input)
 * does not have to hit the filesystem.
 *
 * @param {import('@lmthing/dsh-space-format').Space} space
 * @param {string} agentSlug
 * @param {{ onWarn?: (message: string) => void }} [opts]
 * @returns {ResolvedComponent[]}
 */
export function resolveComponentsFromSpace(space, agentSlug, opts = {}) {
  const onWarn = opts.onWarn ?? ((message) => console.warn(`[space-components] ${message}`))
  const agent = space.agents?.[agentSlug]
  if (!agent) {
    throw new Error(`@lmthing/dsh-space-components: agent "${agentSlug}" not found in space at "${space.dir}"`)
  }

  const view = space.components?.view ?? {}
  const form = space.components?.form ?? {}

  const resolved = []
  for (const name of agent.config.components) {
    const inView = Object.prototype.hasOwnProperty.call(view, name)
    const inForm = Object.prototype.hasOwnProperty.call(form, name)

    if (inView && inForm) {
      onWarn(`agent "${agentSlug}" declares component "${name}", which exists in BOTH components/view and components/form — using the view/ one (space-format's own validation does not disambiguate this; rename one of the two files)`)
    }

    if (inView) {
      resolved.push({ name, kind: 'view', source: view[name] })
    } else if (inForm) {
      resolved.push({ name, kind: 'form', source: form[name] })
    } else {
      throw new Error(`@lmthing/dsh-space-components: agent "${agentSlug}" declares component "${name}" but it is in neither components/view nor components/form of the space at "${space.dir}"`)
    }
  }
  return resolved
}
