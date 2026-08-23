import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { loadSpace } from '@lmthing/dsh-space-format'

/** Same extension set space-format's loader recognizes under functions/ (see its load.js doc comment). */
const FUNCTION_FILE_EXTENSIONS = ['.js', '.mjs', '.ts', '.tsx']

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve one function name to its on-disk file, trying each recognized
 * extension in order. Throws if none exist — `loadSpace` already validated
 * the name is declared and present when it loaded the space, so a miss here
 * means the file was removed between load and mount, not an authoring error.
 * @param {string} spaceDir
 * @param {string} name
 * @returns {Promise<string>}
 */
async function resolveFunctionFile(spaceDir, name) {
  for (const ext of FUNCTION_FILE_EXTENSIONS) {
    const candidate = join(spaceDir, 'functions', `${name}${ext}`)
    if (await fileExists(candidate)) return candidate
  }
  throw new Error(`@lmthing/dsh-space-functions: function "${name}" not found under "${join(spaceDir, 'functions')}" (tried: ${FUNCTION_FILE_EXTENSIONS.join(', ')})`)
}

/**
 * Load the space at `spaceDir` and resolve the file path for every function
 * agent `agentSlug` declares (`agent.config.functions`). Pure and
 * unit-testable without Cordis — the plugin's `apply()` is a thin wrapper
 * calling this then `ctx.tools.register`.
 * @param {string} spaceDir
 * @param {string} agentSlug
 * @returns {Promise<{ name: string, file: string }[]>}
 */
export async function resolveFunctionTools(spaceDir, agentSlug) {
  const space = await loadSpace(spaceDir)
  const agent = space.agents[agentSlug]
  if (!agent) {
    throw new Error(`@lmthing/dsh-space-functions: agent "${agentSlug}" not found in space at "${spaceDir}"`)
  }

  const tools = []
  for (const name of agent.config.functions) {
    tools.push({ name, file: await resolveFunctionFile(spaceDir, name) })
  }
  return tools
}
