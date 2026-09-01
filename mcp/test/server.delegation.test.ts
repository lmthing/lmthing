import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Agent, Project, Space } from '../src/format/types.ts';
import { SpaceServerContext } from '../src/server/context.ts';
import { tools as delegationTools } from '../src/tools/delegation.ts';

/**
 * The delegation allowlist is ref-matched, and refs gained a project part. The trap this pins:
 * the format's native two-part entry (`<space>/<slug>`) must resolve PROJECT-LOCALLY — when
 * two projects both hold a space of that id, the source agent's own project wins and the
 * other is NOT silently pulled into the allowlist. Only a three-part ref crosses projects.
 * This failed live (the allowlist resolved to nothing) while every parser test stayed green.
 */
function agent(ref: string, overrides: Partial<Agent> = {}): Agent {
  const [proj, spaceId, slug] = ref.split('/');
  return { ref, project: proj!, space: spaceId!, slug: slug!, title: slug!, charter: '', instruct: '', functions: [], knowledge: [], capabilities: [], canDelegateTo: undefined, actions: [], ...overrides };
}
function space(project: string, id: string, agents: Agent[]): Space {
  return { id, project, ref: `${project}/${id}`, dir: `/rt/${project}/spaces/${id}`, agents, functions: [], knowledge: [], tasklists: {}, manifest: {}, unsupported: [] };
}
const acme = space('acme', 'demo', [
  agent('acme/demo/local', { canDelegateTo: ['demo/helper'] }),          // two-part: project-local
  agent('acme/demo/helper'),
]);
const beta = space('beta', 'demo', [
  agent('beta/demo/foreign'),                                            // same space id, other project
  agent('beta/demo/cross', { canDelegateTo: ['acme/demo/helper'] }),     // three-part: crosses projects
  agent('beta/demo/none', { canDelegateTo: [] }),
  agent('beta/demo/wild', { canDelegateTo: ['*'] }),
  agent('beta/demo/open'),                                               // omitted: unrestricted
]);
const project = (id: string, spaces: Space[]): Project => ({ id, dir: `/rt/${id}`, spacesDir: `/rt/${id}/spaces`, spaces });
const loader = async () => [project('acme', [acme]), project('beta', [beta])];

const byName = async (activeRef: string) => {
  const context = new SpaceServerContext({ runtimeDir: '/rt', loader });
  await context.setActiveAgent(activeRef);
  return new Map(delegationTools(context).map((tool) => [tool.name, tool]));
};
const refs = async (tool: Map<string, any>) =>
  ((await tool.get('list_delegates')!.handler()) as Array<{ ref: string }>).map((entry) => entry.ref).sort();

describe('delegation across projects', () => {
  test('a two-part allowlist entry resolves in the source agent’s own project only', async () => {
    assert.deepEqual(await refs(await byName('acme/demo/local')), ['acme/demo/helper'], 'the beta/demo/foreign agent must NOT match');
  });

  test('a three-part allowlist entry crosses projects', async () => {
    assert.deepEqual(await refs(await byName('beta/demo/cross')), ['acme/demo/helper']);
  });

  test('empty means none, wildcard and omitted mean unrestricted', async () => {
    assert.deepEqual(await refs(await byName('beta/demo/none')), []);
    const wide = await refs(await byName('beta/demo/wild'));
    assert.equal(wide.length, 7, 'wildcard sees every agent in every project');
    assert.deepEqual(await refs(await byName('beta/demo/open')), wide, 'omitted is unrestricted, same as *');
  });

  test('get_delegate accepts both ref forms; a non-delegate is refused', async () => {
    const t = await byName('acme/demo/local');
    const local = await t.get('get_delegate')!.handler({ ref: 'demo/helper' }) as { ref: string };
    assert.equal(local.ref, 'acme/demo/helper', 'the project-local form works');
    assert.equal(((await t.get('get_delegate')!.handler({ ref: 'acme/demo/helper' })) as { ref: string }).ref, 'acme/demo/helper');
    await assert.rejects(t.get('get_delegate')!.handler({ ref: 'beta/demo/foreign' }), /not available/);
  });
});
