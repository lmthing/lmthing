import { rm } from 'node:fs/promises';
import { readyNodes } from '../format/dag.ts';
import type { Space, TaskNode, TasklistDag } from '../format/types.ts';
import { completedIds, freshRun, inProgressIds, loadRun, reconcile, runFile, saveRun } from '../exec/runstate.ts';
import type { TasklistRun } from '../exec/runstate.ts';
import type { ToolDef, ToolGroup } from './ctx.ts';

const emptyObject = { type: 'object', properties: {}, additionalProperties: false } as const;
function active(ctx: Parameters<ToolGroup>[0]) { const agent = ctx.activeAgent(); const space = ctx.activeSpace(); if (!agent || !space) throw new Error('No active agent selected'); return { agent, space }; }
function string(args: Record<string, unknown>, key: string): string { const value = args[key]; if (typeof value !== 'string' || !value) throw new Error(`${key} must be a non-empty string`); return value; }
function tasklist(space: Space, slug: string): TasklistDag { const found = space.tasklists[slug]; if (!found) throw new Error(`Unknown tasklist ${slug}; available: ${Object.keys(space.tasklists).join(', ') || '(none)'}`); return found; }
function nodeOf(dag: TasklistDag, id: string): TaskNode { const node = dag.nodes.find((item) => item.id === id); if (!node) throw new Error(`Unknown node ${id} in tasklist ${dag.slug}; available: ${dag.nodes.map((item) => item.id).join(', ') || '(none)'}`); return node; }
function now(): string { return new Date().toISOString(); }
function slugArg(args: Record<string, unknown>): string { return string(args, 'slug'); }

/**
 * Tasklists belong to AGENTS: every tool here addresses the ACTIVE agent's tasklists (an
 * agent's `actions:` name the tasklists it drives), never a runtime-wide slug lookup.
 */
export const tools: ToolGroup = (ctx): ToolDef[] => [
  { name: 'list_tasklists', description: 'List tasklist slugs and the active agent actions that back them.', inputSchema: emptyObject, async handler() {
    const { agent, space } = active(ctx);
    return Object.keys(space.tasklists).sort().map((slug) => ({ slug, actions: agent.actions.filter((action) => action.tasklist === slug).map((action) => ({ id: action.id, label: action.label, description: action.description })) }));
  } },
  { name: 'get_tasklist', description: 'Get the parsed tasklist DAG plus the persisted run state, if any.', inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'], additionalProperties: false }, async handler(args) {
    const { agent, space } = active(ctx);
    const dag = tasklist(space, slugArg(args));
    const stored = await loadRun(runFile(ctx.runtimeDir, space.project, space.id, agent.slug, dag.slug));
    return { ...dag, run: stored ? { completed: completedIds(stored), inProgress: inProgressIds(stored) } : null };
  } },
  { name: 'get_tasklist_node', description: 'Get one tasklist node and its client-walkable dependency metadata.', inputSchema: { type: 'object', properties: { slug: { type: 'string' }, id: { type: 'string' } }, required: ['slug', 'id'], additionalProperties: false }, async handler(args) {
    const { space } = active(ctx);
    const dag = tasklist(space, slugArg(args)); const node = nodeOf(dag, string(args, 'id'));
    return { id: node.id, title: node.title, body: node.body, dependsOn: node.dependsOn, condition: node.condition, forEach: node.forEach, output: node.output };
  } },
  {
    /**
     * `completed` is how the PURE topology query stays pure; omit it and the answer comes from
     * the persisted run instead. A harness that walks the DAG by hand passes the list; one
     * driving the run through start/complete_task omits it.
     */
    name: 'next_tasklist_nodes',
    description: 'Return uncompleted nodes whose dependencies are all completed — from the persisted run when `completed` is omitted, otherwise from the given list (pure topology).',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' }, completed: { type: 'array', items: { type: 'string' } } }, required: ['slug'], additionalProperties: false }, async handler(args) {
      const { agent, space } = active(ctx);
      const dag = tasklist(space, slugArg(args));
      if (args.completed === undefined) {
        const stored = await loadRun(runFile(ctx.runtimeDir, space.project, space.id, agent.slug, dag.slug));
        if (!stored) throw new Error(`No run state for ${dag.slug} — call start_task first, or pass completed explicitly.`);
        return readyNodes(dag, completedIds(stored));
      }
      const completed = args.completed;
      if (!Array.isArray(completed) || completed.some((id) => typeof id !== 'string')) throw new Error('completed must be an array of strings');
      return readyNodes(dag, completed as string[]);
    },
  },
  {
    /**
     * The harness-side of walking a DAG with the state held PROGRAMMATICALLY. With an `id`:
     * begin that node — blocked or already-done nodes are refused with guidance naming what IS
     * ready (the drift nudge), a start hands back the node body AND its dependencies' recorded
     * outputs, so the harness carries nothing between calls. Without an `id`: a standings
     * report. `reset: true` throws the run away and starts over.
     */
    name: 'start_task',
    description: 'Start or resume the ACTIVE agent’s tasklist run. With `id`: begin that node — refuses with guidance when it is blocked or already done, and returns the node body plus its dependencies’ recorded outputs. Without `id`: report where the run stands and what is ready next. `reset: true` starts the run over.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' }, id: { type: 'string' }, reset: { type: 'boolean', description: 'Discard the persisted run and start over.' } }, required: ['slug'], additionalProperties: false },
    async handler(args) {
      const { agent, space } = active(ctx);
      const dag = tasklist(space, slugArg(args));
      const file = runFile(ctx.runtimeDir, space.project, space.id, agent.slug, dag.slug);
      if (args.reset === true) await rm(file, { force: true });
      let run: TasklistRun | undefined = await loadRun(file);
      const created = !run;
      if (!run) run = freshRun(dag, agent.slug, space.project, now());
      const adjusted = reconcile(run, dag);
      if (adjusted.length) { run.updatedAt = now(); await saveRun(file, run); }
      const standings = () => ({
        slug: dag.slug,
        ref: `${space.ref}/${dag.slug}`,
        goal: dag.goal,
        completed: completedIds(run!),
        inProgress: inProgressIds(run!),
        ready: readyEntries(dag, run!),
        runComplete: completedIds(run!).length === dag.nodes.length,
        ...(adjusted.length ? { adjustedFromRun: adjusted } : {}),
      });

      if (args.id === undefined) {
        if (created || adjusted.length) await saveRun(file, run);
        return standings();
      }

      const id = string(args, 'id');
      const node = nodeOf(dag, id);
      const record = run.nodes[id];
      if (record?.status === 'complete') {
        return {
          slug: dag.slug, node: id, started: false, alreadyCompleted: true, output: record.output ?? null,
          completed: completedIds(run),
          ...(adjusted.length ? { adjustedFromRun: adjusted } : {}),
          nudge: `"${id}" is already complete — its recorded output is included. Pass reset: true on start_task to run "${dag.slug}" again.`,
        };
      }
      const missing = node.dependsOn.filter((dep) => run.nodes[dep]?.status !== 'complete');
      if (missing.length > 0) {
        const detail = missing.map((dep) => `${dep}: ${run.nodes[dep]?.status ?? 'not started'}`).join(', ');
        throw new Error(`Cannot start "${id}": dependsOn [${missing.join(', ')}] not complete (${detail}). Ready now: ${readyNodes(dag, completedIds(run)).join(', ') || '(nothing)'}. If a dependency already finished, complete_task it first.`);
      }
      const resumed = record?.status === 'in_progress';
      run.nodes[id] ??= { status: 'in_progress', startedAt: now() };
      run.updatedAt = now();
      await saveRun(file, run);
      return {
        slug: dag.slug,
        node: { id: node.id, title: node.title, body: node.body, dependsOn: node.dependsOn, condition: node.condition, forEach: node.forEach, output: node.output },
        inputs: inputsFor(run, node),
        resumed,
        ...(adjusted.length ? { adjustedFromRun: adjusted } : {}),
        run: { completed: completedIds(run), inProgress: inProgressIds(run) },
      };
    },
  },
  {
    /**
     * The counterpart: record a node's output, persist, and hand back what became ready — with
     * each ready node's `inputs` inline, so the next `start_task` answer is already briefed.
     * A node completed out of order is refused loudly (isError) with the ready list; a
     * completion that ignores the node's declared `output:` fields is accepted but nudged.
     */
    name: 'complete_task',
    description: 'Mark a started node complete, record its output, persist the run, and return the nodes that became ready (with their inputs). Refuses with guidance when the node was never started or is already complete; nudges when the completion omits fields the node declares in `output:`.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' }, id: { type: 'string' }, output: { type: 'object', additionalProperties: true, description: 'The node’s result, keyed by the fields its `output:` declares.' } }, required: ['slug', 'id'], additionalProperties: false },
    async handler(args) {
      const { agent, space } = active(ctx);
      const dag = tasklist(space, slugArg(args));
      const id = string(args, 'id');
      const node = nodeOf(dag, id);
      const file = runFile(ctx.runtimeDir, space.project, space.id, agent.slug, dag.slug);
      const run = await loadRun(file);
      if (!run) throw new Error(`complete_task called but there is no run state for ${dag.slug} — nothing has started. Ready now: ${readyNodes(dag, []).join(', ') || '(nothing)'}. Call start_task first.`);
      const adjusted = reconcile(run, dag);
      if (adjusted.length) { run.updatedAt = now(); await saveRun(file, run); }
      const record = run.nodes[id];
      if (!record) {
        throw new Error(`complete_task called for "${id}" but it was never started. In progress: ${inProgressIds(run).join(', ') || 'none'}. Ready now: ${readyNodes(dag, completedIds(run)).join(', ') || '(nothing)'}. Call start_task("${id}") first.`);
      }
      if (record.status === 'complete') {
        return {
          slug: dag.slug, node: id, completed: false, alreadyCompleted: true, completedAt: record.completedAt, output: record.output ?? null,
          ...(adjusted.length ? { adjustedFromRun: adjusted } : {}),
          nudge: `"${id}" was already completed at ${record.completedAt}. Nothing re-recorded.`,
        };
      }
      const nudges: string[] = [];
      let output: Record<string, unknown> | undefined;
      if (args.output !== undefined) {
        if (typeof args.output !== 'object' || args.output === null || Array.isArray(args.output)) throw new Error('output must be an object');
        output = args.output as Record<string, unknown>;
        const declared = Object.keys(node.output ?? {});
        const given = Object.keys(output!);
        const notGiven = declared.filter((key) => !(key in output!));
        if (notGiven.length > 0) nudges.push(`"${id}" declares output [${declared.join(', ')}] but the completion is missing [${notGiven.join(', ')}] — downstream nodes will not receive it.`);
        const unknown = given.filter((key) => !(node.output ?? {})[key]);
        if (unknown.length > 0) nudges.push(`output keys [${unknown.join(', ')}] are not declared by "${id}" — the format only promises [${declared.join(', ') || 'none'}].`);
      } else if (node.output && Object.keys(node.output).length > 0) {
        nudges.push(`"${id}" declares output [${Object.keys(node.output).join(', ')}] but no output was provided.`);
      }
      record.status = 'complete';
      record.completedAt = now();
      if (output) record.output = output;
      run.updatedAt = now();
      await saveRun(file, run);
      return {
        slug: dag.slug, node: id, recorded: record.output ?? null,
        next: readyEntries(dag, run),
        runComplete: completedIds(run).length === dag.nodes.length,
        ...(nudges.length ? { nudge: nudges.join(' ') } : {}),
        ...(adjusted.length ? { adjustedFromRun: adjusted } : {}),
      };
    },
  },
];

/** Upstream outputs for a node, keyed by dependency id — `null` when a dependency recorded none. */
function inputsFor(run: TasklistRun, node: TaskNode): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (const dep of node.dependsOn) {
    const rec = run.nodes[dep];
    inputs[dep] = rec?.status === 'complete' ? (rec.output ?? null) : null;
  }
  return inputs;
}

/** What is runnable now, each entry briefed with its condition and its inputs. */
function readyEntries(dag: TasklistDag, run: TasklistRun): Array<Record<string, unknown>> {
  return readyNodes(dag, completedIds(run)).map((id) => {
    const node = nodeOf(dag, id);
    return { id, body: node.body, condition: node.condition, forEach: node.forEach, declaredOutput: node.output, inputs: inputsFor(run, node) };
  });
}
