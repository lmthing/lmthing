import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Agent, Project, Space } from '../src/format/types.ts';
import { SpaceServerContext } from '../src/server/context.ts';
import { McpSpaceServer } from '../src/server/index.ts';
import { tools as discoveryTools } from '../src/tools/discovery.ts';
import type { ToolGroup } from '../src/tools/ctx.ts';

const first: Agent = { ref: 'default/demo/first', project: 'default', space: 'demo', slug: 'first', title: 'First', charter: 'Charter', instruct: 'Instructions', functions: ['hello'], knowledge: ['guide/topic'], capabilities: [{ id: 'db:read' }], canDelegateTo: undefined, actions: [] };
const second: Agent = { ...first, ref: 'default/demo/second', slug: 'second', title: 'Second', functions: [], canDelegateTo: [] };
const fixture: Space = {
  id: 'demo', project: 'default', ref: 'default/demo', dir: '/rt/default/spaces/demo', agents: [first, second],
  functions: [{ name: 'hello', file: '/rt/default/spaces/demo/functions/hello.ts', description: 'Say hello', schema: { type: 'object' }, order: [], verdict: { kind: 'exact' } }],
  knowledge: [{ name: 'guide', description: 'Guide', fields: [{ name: 'topic', ref: 'guide/topic', description: 'Topic index', options: [] }] }],
  tasklists: { run: { slug: 'run', dir: '/rt/default/spaces/demo/tasklists/run', goal: 'Run it', nodes: [] } }, manifest: { name: 'demo' }, unsupported: [{ path: 'events/', reason: 'Unsupported' }],
};
// One project holding the fixture space — the loader is now runtime-wide.
const project: Project = { id: 'default', dir: '/rt/default', spacesDir: '/rt/default/spaces', spaces: [fixture] };
const loader = async () => [project];

describe('server context and discovery tools', () => {
  test('changes active agent only for a known ref and announces tool changes', async () => {
    let changed = 0;
    const context = new SpaceServerContext({ runtimeDir: '/rt', loader, onToolsChanged: () => { changed += 1; } });
    await assert.rejects(context.setActiveAgent('default/demo/nope'), /Unknown agent/);
    assert.equal(context.activeAgent(), null);
    await context.setActiveAgent('default/demo/first');
    assert.equal(context.activeAgent()?.ref, 'default/demo/first');
    assert.equal(changed, 1);
  });

  test('returns documented discovery shapes and preserves delegation tri-state', async () => {
    const context = new SpaceServerContext({ runtimeDir: '/rt', loader });
    const byName = new Map(discoveryTools(context).map((tool) => [tool.name, tool]));
    assert.deepEqual(await byName.get('list_spaces')!.handler({}), [{ id: 'demo', project: 'default', ref: 'default/demo', dir: '/rt/default/spaces/demo', agentCount: 2, has: ['agents', 'functions', 'knowledge', 'tasklists'], unsupported: fixture.unsupported }]);
    assert.equal(await byName.get('get_active_agent')!.handler({}), null);
    const listed = await byName.get('list_agents')!.handler({}) as Array<Record<string, unknown>>;
    assert.equal(listed[0]?.canDelegateTo, undefined);
    assert.deepEqual(listed[1]?.canDelegateTo, []);
    assert.deepEqual(await byName.get('describe_space')!.handler({ ref: 'default/demo' }), {
      id: 'demo', dir: '/rt/default/spaces/demo', agents: [
        { ref: 'default/demo/first', slug: 'first', title: 'First', functions: ['hello'], capabilities: [{ id: 'db:read' }], canDelegateTo: undefined, actions: [] },
        { ref: 'default/demo/second', slug: 'second', title: 'Second', functions: [], capabilities: [{ id: 'db:read' }], canDelegateTo: [], actions: [] },
      ], functions: [{ name: 'hello', description: 'Say hello', verdict: { kind: 'exact' } }],
      knowledge: [{ name: 'guide', description: 'Guide', fields: [{ name: 'topic', ref: 'guide/topic', description: 'Topic index', options: [] }] }],
      tasklists: ['run'], manifest: { name: 'demo' }, unsupported: fixture.unsupported,
    });
    assert.deepEqual(await byName.get('describe_agent')!.handler({ ref: 'default/demo/first' }), {
      ref: 'default/demo/first', slug: 'first', title: 'First', charter: 'Charter', instruct: 'Instructions', functions: ['hello'], knowledge: ['guide/topic'], capabilities: [{ id: 'db:read' }], canDelegateTo: undefined, actions: [], resolvedTools: [{ name: 'hello', description: 'Say hello', verdict: { kind: 'exact' } }],
    });
    await byName.get('set_agent')!.handler({ ref: 'default/demo/second' });
    assert.equal(await byName.get('get_active_agent')!.handler({}), 'default/demo/second');
  });

  test('rebuilds active-agent tools before firing the list-changed notification', async () => {
    const app = new McpSpaceServer({ runtimeDir: '/rt', loader });
    let notifications = 0;
    app.server.sendToolListChanged = async () => { notifications += 1; };
    await app.initialize();
    assert.equal(app.toolNames().includes('hello'), false);
    await app.ctx.setActiveAgent('demo/first');
    assert.equal(app.toolNames().includes('hello'), true);
    await app.ctx.setActiveAgent('default/demo/second');
    assert.equal(app.toolNames().includes('hello'), false);
    assert.equal(notifications, 2);
  });

  test('rejects duplicate tool names', async () => {
    const app = new McpSpaceServer({ runtimeDir: '/rt', loader });
    const duplicate: ToolGroup = () => [{ name: 'same', description: '', inputSchema: {}, handler: async () => null }];
    await assert.rejects(app.rebuildTools([duplicate, duplicate]), /Duplicate MCP tool name: same/);
  });

  test('turns a thrown handler into an MCP tool error', async () => {
    const app = new McpSpaceServer({ runtimeDir: '/rt', loader });
    const broken: ToolGroup = () => [{ name: 'broken', description: '', inputSchema: {}, handler: async () => { throw new Error('boom'); } }];
    await app.rebuildTools([broken]);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '1' });
    await app.server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({ name: 'broken', arguments: {} });
    assert.equal(result.isError, true);
    assert.deepEqual(result.content, [{ type: 'text', text: 'boom' }]);
  });
});
