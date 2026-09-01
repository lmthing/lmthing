import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { TasklistDag } from '../format/types.ts';

/**
 * Persisted DAG run state — the answer to "the client holds all the state".
 *
 * A run is ONE file per (agent, tasklist) under
 * `<runtimeDir>/<project>/.runs/<spaceId>/<agentSlug>/<slug>.json`. Tasklists belong to
 * agents — they are reached through the active agent, whose `actions:` name them — so the run
 * is keyed by that agent too: two agents sharing a space can never clobber each other's run.
 * The file lives OUTSIDE `spaces/` deliberately: it is runtime data, not format data, so the
 * parser never sees it and `validate_space` is never confused by it. Every `start_task` /
 * `complete_task` call re-reads and re-writes it, so a harness that reconnects mid-run loses
 * nothing — it asks the server where it is instead of re-deriving from its own transcript.
 */

export type TaskStatus = 'in_progress' | 'complete';

export interface TaskRecord {
  status: TaskStatus;
  startedAt: string;
  completedAt?: string;
  /** Whatever the harness reported when completing the node, verbatim. */
  output?: Record<string, unknown>;
}

export interface TasklistRun {
  version: 1;
  slug: string;
  /** The agent driving the run, the owning space id, and the project — provenance, and a
   *  guard against a state file moved somewhere it does not belong. */
  agent: string;
  space: string;
  project: string;
  startedAt: string;
  updatedAt: string;
  nodes: Record<string, TaskRecord>;
}

/** `<runtimeDir>/<project>/.runs/<spaceId>/<agentSlug>/<slug>.json` */
export function runFile(runtimeDir: string, project: string, spaceId: string, agentSlug: string, slug: string): string {
  return join(runtimeDir, project, '.runs', spaceId, agentSlug, `${slug}.json`);
}

export async function loadRun(file: string): Promise<TasklistRun | undefined> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  try {
    return JSON.parse(raw) as TasklistRun;
  } catch (error: unknown) {
    // Corrupt state must be loud: silently starting a fresh run would let a harness believe
    // upstream outputs exist that the record no longer holds.
    throw new Error(`Run state ${file} is not valid JSON: ${(error as Error).message}`);
  }
}

export async function saveRun(file: string, run: TasklistRun): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  // Atomic via tmp+rename: a crash mid-write must leave the previous state intact.
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(run, null, 2), 'utf8');
  await rename(tmp, file);
}

export function freshRun(dag: TasklistDag, agentSlug: string, project: string, now: string): TasklistRun {
  return { version: 1, slug: dag.slug, agent: agentSlug, space: spaceIdOf(dag), project, startedAt: now, updatedAt: now, nodes: {} };
}

function spaceIdOf(dag: TasklistDag): string {
  // `<...>/spaces/<spaceId>/tasklists/<slug>` — the space id is two levels above the tasklist.
  const parts = dag.dir.split(/[/\\]/);
  return parts[parts.length - 4] ?? '';
}

/**
 * Drop records for node ids that no longer exist — a tasklist edited mid-run would otherwise
 * leave ghost completions that satisfy nothing. Returns the dropped ids so callers can say so.
 */
export function reconcile(run: TasklistRun, dag: TasklistDag): string[] {
  const known = new Set(dag.nodes.map((node) => node.id));
  const dropped = Object.keys(run.nodes).filter((id) => !known.has(id));
  for (const id of dropped) delete run.nodes[id];
  return dropped;
}

export function completedIds(run: TasklistRun): string[] {
  return Object.keys(run.nodes).filter((id) => run.nodes[id]!.status === 'complete');
}

export function inProgressIds(run: TasklistRun): string[] {
  return Object.keys(run.nodes).filter((id) => run.nodes[id]!.status === 'in_progress');
}
