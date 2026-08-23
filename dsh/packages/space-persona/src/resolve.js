import { loadSpace } from '@lmthing/dsh-space-format'

/**
 * Join charter.md + instruct.md bodies into one persona text. Fail loud on a
 * literal `{{` — dsh-persona's `text` is a STRICT template (unknown `{{...}}`
 * references throw at render, not at generation), and no ported LMThing
 * content is expected to contain one; if it does, catching it here beats a
 * mysterious crash on the first turn. Ported unchanged from the Phase 1
 * `space-preset/src/compose.js` this package replaces.
 * @param {{ charterBody: string, instructBody: string }} agent
 * @returns {string}
 */
export function buildPersonaText(agent) {
  const text = [agent.charterBody, agent.instructBody].filter(Boolean).join('\n\n')
  if (text.includes('{{')) {
    throw new Error(
      `agent persona text contains a literal "{{" — dsh-persona templates are strict and this port has no escaping story yet (see dsh/packages/README.md roadmap)`,
    )
  }
  return text
}

/**
 * Load the space at `spaceDir` and build agent `agentSlug`'s persona text.
 * Pure and unit-testable without Cordis — the plugin's `apply()` is a thin
 * wrapper calling this then `ctx.plugin(dsh-persona, { text })`.
 * @param {string} spaceDir
 * @param {string} agentSlug
 * @returns {Promise<string>}
 */
export async function resolvePersonaText(spaceDir, agentSlug) {
  const space = await loadSpace(spaceDir)
  const agent = space.agents[agentSlug]
  if (!agent) {
    throw new Error(`@lmthing/dsh-space-persona: agent "${agentSlug}" not found in space at "${spaceDir}"`)
  }
  return buildPersonaText(agent)
}
