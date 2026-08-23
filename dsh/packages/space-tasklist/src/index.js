import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolveTasklistTools } from './resolve.js'

/**
 * Self-loading dsh plugin (architecture pivot, see dsh/packages/README.md):
 * given `{ spaceDir, agentSlug }`, loads the space itself, compiles every
 * tasklist the agent exposes as an ACTION into a `@deepseek-ai/dsh-workflow`
 * script (see `./compile.js` for the compiler and for the full table of what
 * does and does not map), and registers one dedicated dsh tool per action.
 *
 * **Deliberately bypasses `@deepseek-ai/dsh-tool-workflow`.** That package's
 * whole contract is "the model writes the JS script" — it takes `script` and
 * `meta` as model-supplied parameters. Ours is HOST-compiled from an
 * author-written DAG, so the model must see a plain named tool with an ordinary
 * typed parameter schema (built from the tasklist's own `input:` map) and never
 * the script text at all. We call `ctx.workflowEngine.start()` directly
 * instead, and mirror `dsh-tool-workflow`'s own documented lifecycle contract:
 * forward the caller's abort to `run.cancel()`, `await run.result`, and ALWAYS
 * `run.dispose()` in a `finally` ("a run is holder-owned... the holder must
 * call dispose() on every path"). A non-`completed` stop reason throws, which
 * becomes an `isError` tool result — partial output is never reported as
 * success.
 *
 * `inject: ['tools', 'workflowEngine']` — `workflowEngine` is provided by
 * `@deepseek-ai/dsh-workflow-worker-thread`, which `@deepseek-ai/dsh-base`
 * already mounts in its own default patch (`id: workflow-worker-thread`), so
 * every profile built on the base bundle has it without an extra row.
 *
 * The `await` on the async resolve/compile work below is NOT optional. See
 * `@lmthing/dsh-space`'s doc comment: an `apply()` that returns before its
 * async work finishes lets the tools it registers silently miss the first
 * request's tool-schema snapshot, with no thrown error anywhere. The same rule
 * applies to any nested `ctx.plugin()` call added here later.
 *
 * ## A real incident this plugin must guard against: recursive self-invocation
 *
 * `ctx.workflowEngine.start()`'s children (the compiled script's `agent()`
 * calls) join the SAME shared preset as the calling agent — the identical
 * "dsh subagents join the parent's own preset" fact already documented for
 * `space-delegate`, which there is worked around by giving a delegated child
 * its OWN `persona` (a `dsh-tool-subagent` config field). Workflow's `agent()`
 * has no equivalent per-call persona override, and in a preset-less
 * deployment (no `dsh-agent-presets` yet — see the plan) EVERY agent, top-level
 * or workflow-spawned, shares the one ambient global persona AND the one
 * global tool registry. A real live run hit this: the tasklist-demo agent's
 * own persona says "when asked to plan a topic, call `run_tasklist_*`" — a
 * workflow-spawned child, given a plan node's own sub-task ("split this topic
 * into three angles"), inherited that exact instruction, decided it too
 * should call `run_tasklist_*`, and did — spawning a full nested workflow run
 * whose own first child did the same thing. Depth grew without bound (dozens
 * of real model calls in well under a minute) with no error anywhere, because
 * nothing here was malformed — every individual call succeeded.
 *
 * Fix: a global `ctx.tools.guard()` refuses re-entrant calls to a tasklist
 * tool while a run for that SAME tool name is already in flight, tracked in
 * `activeRunToolNames` below. This is deliberately per-tool-name (not "any
 * tasklist tool"), so two DIFFERENT tasklist tools can still legitimately
 * both be in flight at once — only true self-recursion is refused. This is a
 * defensive backstop, not a workaround for a fixable authoring mistake: the
 * hazard exists for ANY space that mounts this plugin under a preset-less
 * deployment, regardless of how carefully a persona is worded, because dsh
 * gives this plugin no way to hide a tool from only a workflow's own
 * children.
 *
 * config: { spaceDir: string, agentSlug: string }
 */
export const name = 'lmthing-space-tasklist'
export const inject = ['tools', 'workflowEngine']

export async function apply(ctx, config) {
  const specs = await resolveTasklistTools(config.spaceDir, config.agentSlug, {
    onWarn: (message) => ctx.logger?.warn?.(`space-tasklist: ${message}`) ?? console.warn(`[space-tasklist] ${message}`),
  })

  const activeRunToolNames = new Set()
  ctx.tools.guard((execution) => {
    if (activeRunToolNames.has(execution.name)) {
      return `"${execution.name}" is already running in this call chain — refused to prevent unbounded recursion (a workflow-spawned child inherited this tool from the shared preset; see @lmthing/dsh-space-tasklist's doc comment)`
    }
    return undefined
  })

  for (const spec of specs) {
    ctx.tools.register(defineTool({
      name: spec.toolName,
      description: spec.description,
      parameters: spec.parameters,
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            runId: { type: 'string', required: true },
            agentsStarted: { type: 'integer', required: true },
            result: { type: 'json', required: true },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `tasklist "${spec.tasklist}" completed (${value.agentsStarted} agent${value.agentsStarted === 1 ? '' : 's'}).\nGoal output:\n${JSON.stringify(value.result, null, 2)}`,
        }],
      },
      async execute(args, exec) {
        const parent = exec.agent
        if (!parent) {
          throw new Error(`${spec.toolName}: a tasklist run needs a calling agent to attribute its child agents to (exec.agent was undefined)`)
        }

        activeRunToolNames.add(spec.toolName)
        const run = ctx.workflowEngine.start({
          meta: spec.meta,
          script: spec.script,
          args,
          parent,
          signal: exec.signal,
        })

        const onAbort = () => { run.cancel('calling tool step aborted') }
        exec.signal.addEventListener('abort', onAbort, { once: true })
        try {
          const result = await run.result
          if (result.stopReason !== 'completed') {
            throw new Error(`tasklist "${spec.tasklist}" did not complete (${result.stopReason})${result.error ? `: ${result.error}` : ''}`)
          }
          return { runId: run.id, agentsStarted: result.agentsStarted, result: result.value }
        } finally {
          activeRunToolNames.delete(spec.toolName)
          exec.signal.removeEventListener('abort', onAbort)
          await run.dispose()
        }
      },
    }))
  }
}

export { compileTasklistToWorkflowScript, validateTask, mergedDependencies, topologicalOrder, outputObjectSchema } from './compile.js'
export { loadTasklist, loadTasklistFromSpace, extractCodeNodeMeta } from './load.js'
export { evaluateCondition, referencedTaskIds } from './condition-dsl.js'
export { resolveTasklistTools, parameterSchemaFromInput, actionToolName } from './resolve.js'
