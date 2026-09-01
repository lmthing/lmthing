import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Agent, Project, Space, TasklistDag } from '../src/format/types.ts';
import { SpaceServerContext } from '../src/server/context.ts';
import { tools as tasklistTools } from '../src/tools/tasklists.ts';
import { completedIds, loadRun, runFile } from '../src/exec/runstate.ts';

/**
 * The run-state tools: state lives PROGRAMMATICALLY on disk, and a harness that drifts —
 * starting a blocked node, completing one never started, skipping a declared output — is
 * nudged back with guidance naming what IS ready, rather than silently corrupting the run.
 */
const dag: TasklistDag = {
  slug: 'run_probe', dir: '/rt/default/spaces/demo/tasklists/run_probe', goal: 'Diamond',
  input: { target: 'string' },
  nodes: [
    { id: 'start', file: '01.md', body: 'Gather.', dependsOn: [], output: { samples: 'array' } },
    { id: 'inspect', file: '02.md', body: 'Inspect.', dependsOn: ['start'], condition: 'start.samples != null', output: { findings: 'array' } },
    { id: 'expand', file: '03.md', body: 'Expand.', dependsOn: ['start'], forEach: 'start.samples', output: { finding: 'string' } },
    { id: 'report', file: '04.md', body: 'Report.', dependsOn: ['inspect', 'expand'], output: { report: 'string' } },
  ],
};
const agent: Agent = { ref: 'default/demo/walker', project: 'default', space: 'demo', slug: 'walker', title: 'Walker', charter: '', instruct: '', functions: [], knowledge: [], capabilities: [], canDelegateTo: undefined, actions: [] };
const space: Space = { id: 'demo', project: 'default', ref: 'default/demo', dir: '/rt/default/spaces/demo', agents: [agent], functions: [], knowledge: [], tasklists: { run_probe: dag }, manifest: {}, unsupported: [] };
const project: Project = { id: 'default', dir: '/rt/default', spacesDir: '/rt/default/spaces', spaces: [space] };

let runtimeDir: string;
let context: SpaceServerContext;
let byName: Map<string, any>;

before(async () => {
  runtimeDir = await mkdtemp(join(tmpdir(), 'taskrun-'));
  context = new SpaceServerContext({ runtimeDir, loader: async () => [project] });
  await context.setActiveAgent('default/demo/walker');
  byName = new Map(tasklistTools(context).map((tool) => [tool.name, tool]));
});
after(async () => { await rm(runtimeDir, { recursive: true, force: true }); });

const stateFile = () => runFile(runtimeDir, 'default', 'demo', 'walker', 'run_probe');
const call = (name: string, args: Record<string, unknown>) => byName.get(name)!.handler(args);
const state = async () => (await loadRun(stateFile()))!;

describe('start_task / complete_task over a persisted run', () => {
  test('a bare start_task creates the run and reports the entry node', async () => {
    const fresh = await call('start_task', { slug: 'run_probe' });
    assert.deepEqual(fresh.completed, []);
    assert.deepEqual(fresh.ready.map((entry: { id: string }) => entry.id), ['start']);
    assert.equal(fresh.runComplete, false);
    assert.ok((await loadRun(stateFile())), 'the run must be persisted immediately');
  });

  test('starting a blocked node is refused with guidance naming what IS ready', async () => {
    await assert.rejects(call('start_task', { slug: 'run_probe', id: 'report' }), (error: Error) => {
      assert.match(error.message, /Cannot start "report"/);
      assert.match(error.message, /dependsOn \[inspect, expand\] not complete/);
      assert.match(error.message, /Ready now: start/);
      return true;
    });
  });

  test('completing a node that was never started is refused with the fix in the message', async () => {
    await assert.rejects(call('complete_task', { slug: 'run_probe', id: 'start' }), /never started[\s\S]*start_task\("start"\)/);
  });

  test('start_task hands back the node and its dependencies’ recorded outputs', async () => {
    const started = await call('start_task', { slug: 'run_probe', id: 'start' });
    assert.equal(started.node.body, 'Gather.');
    assert.deepEqual(started.inputs, {});
    assert.deepEqual(started.run.inProgress, ['start']);

    const done = await call('complete_task', { slug: 'run_probe', id: 'start', output: { samples: [1, 2] } });
    assert.deepEqual(done.recorded, { samples: [1, 2] });
    assert.equal(done.runComplete, false);
    assert.deepEqual(done.next.map((entry: { id: string }) => entry.id), ['inspect', 'expand'], 'the diamond forks');
    assert.deepEqual(done.next[0].inputs.start, { samples: [1, 2] }, 'ready entries carry upstream outputs');
  });

  test('restarting a completed node nudges instead of duplicating work', async () => {
    const again = await call('start_task', { slug: 'run_probe', id: 'start' });
    assert.equal(again.started, false);
    assert.equal(again.alreadyCompleted, true);
    assert.deepEqual(again.output, { samples: [1, 2] });
    assert.match(again.nudge, /reset: true/);
  });

  test('completing a node that ignored its declared output is accepted but nudged', async () => {
    await call('start_task', { slug: 'run_probe', id: 'expand' });
    const done = await call('complete_task', { slug: 'run_probe', id: 'expand' });
    assert.match(done.nudge, /declares output \[finding\] but no output was provided/);
    assert.equal((await state()).nodes.expand!.status, 'complete');

    await call('start_task', { slug: 'run_probe', id: 'inspect' });
    const wrong = await call('complete_task', { slug: 'run_probe', id: 'inspect', output: { nonsense: true } }) as { nudge: string };
    assert.match(wrong.nudge, /missing \[findings\]/);
    assert.match(wrong.nudge, /\[nonsense\] are not declared/);
  });

  test('the join holds: report starts only after BOTH branches, and resumes in progress', async () => {
    const started = await call('start_task', { slug: 'run_probe', id: 'report' });
    assert.equal(started.resumed, false);
    assert.deepEqual(started.inputs.inspect, { nonsense: true }, 'output is recorded verbatim — wrong keys were nudged at completion');
    assert.deepEqual(started.inputs.expand, null, 'expand recorded no output');

    const resumed = await call('start_task', { slug: 'run_probe', id: 'report' });
    assert.equal(resumed.resumed, true, 'restarting an in-progress node is a resume, not a refusal');

    const done = await call('complete_task', { slug: 'run_probe', id: 'report', output: { report: 'done' } });
    assert.equal(done.runComplete, true);
    assert.deepEqual(done.next, []);
    assert.deepEqual(await call('next_tasklist_nodes', { slug: 'run_probe' }), [], 'completed omitted → derived from the run');
  });

  test('reset throws the run away', async () => {
    const fresh = await call('start_task', { slug: 'run_probe', reset: true });
    assert.deepEqual(fresh.completed, []);
    assert.deepEqual((await state()).nodes, {});
  });

  test('state edited out from under the DAG is reconciled and reported, not silently kept', async () => {
    await writeFile(stateFile(), JSON.stringify({ version: 1, slug: 'run_probe', agent: 'walker', space: 'demo', project: 'default', startedAt: 't', updatedAt: 't', nodes: { start: { status: 'complete', startedAt: 't', completedAt: 't' }, ghost: { status: 'complete', startedAt: 't', completedAt: 't' } } }), 'utf8');
    const resumed = await call('start_task', { slug: 'run_probe', id: 'start' });
    assert.deepEqual(resumed.adjustedFromRun, ['ghost']);
    assert.deepEqual((await state()).nodes.ghost, undefined);
  });

  test('corrupt state is loud, never a silent fresh start', async () => {
    await writeFile(stateFile(), '{not json', 'utf8');
    await assert.rejects(call('start_task', { slug: 'run_probe' }), /not valid JSON/);
    await rm(stateFile(), { force: true });
  });

  test('the pure topology query still works with an explicit completed list', async () => {
    assert.deepEqual(await call('next_tasklist_nodes', { slug: 'run_probe', completed: ['start'] }), ['inspect', 'expand']);
  });

  test('get_tasklist reports the run alongside the DAG', async () => {
    await call('start_task', { slug: 'run_probe' });            // (re)create state; earlier tests removed it
    const listed = await call('get_tasklist', { slug: 'run_probe' });
    assert.deepEqual(listed.run, { completed: [], inProgress: [] });
    const emptyDir = await mkdtemp(join(tmpdir(), 'taskrun-empty-'));
    try {
      const noRun = new SpaceServerContext({ runtimeDir: emptyDir, loader: async () => [project] });
      await noRun.setActiveAgent('default/demo/walker');
      const other = new Map(tasklistTools(noRun).map((tool) => [tool.name, tool]));
      const listed2 = await other.get('get_tasklist')!.handler({ slug: 'run_probe' }) as { run: unknown };
      assert.equal(listed2.run, null, 'no state file → run: null');
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});
