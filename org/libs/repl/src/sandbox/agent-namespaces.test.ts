import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join, resolve } from 'node:path'
import {
  toNamespaceId,
  readSpaceDependencies,
  extractParamSchema,
  buildSpaceAgentTrees,
  createNamespaceGlobals,
  ChainableSpawnPromise,
  formatAgentTreeForPrompt,
} from './agent-namespaces'
import type {
  SpaceAgentTree,
  AgentEntry,
  ParamSchema,
  OnSpawnFn,
} from './agent-namespaces'
import type { AgentSpawnConfig, AgentSpawnResult } from '../session/types'
import type { KnowledgeTree } from '../knowledge/types'

// ── Test Helpers ──

const FIXTURES_DIR = resolve(__dirname, '../../spaces/cooking')

function makeAgentEntry(overrides: Partial<AgentEntry> = {}): AgentEntry {
  return {
    slug: 'test_agent',
    rawSlug: 'test-agent',
    title: 'Test Agent',
    actions: [{ id: 'run', label: 'Run', description: 'Run it', flow: 'flow_run' }],
    paramSchema: { domains: {} },
    ...overrides,
  }
}

function makeTree(overrides: Partial<SpaceAgentTree> = {}): SpaceAgentTree {
  return {
    spaceName: 'test_space',
    spaceDir: '/tmp/test-space',
    agents: [makeAgentEntry()],
    dependencies: [],
    ...overrides,
  }
}

function makeSpawnResult(): AgentSpawnResult {
  return {
    scope: { summary: 'done' },
    result: { answer: 42 },
    keyFiles: ['src/index.ts'],
  }
}

// ── Tests ──

describe('agent-namespaces', () => {
  describe('toNamespaceId', () => {
    it('converts kebab-case to snake_case', () => {
      expect(toNamespaceId('general-advisor')).toBe('general_advisor')
    })

    it('strips prefix when specified', () => {
      expect(toNamespaceId('agent-space-architect', 'agent-')).toBe('space_architect')
    })

    it('strips space- prefix', () => {
      expect(toNamespaceId('space-cooking', 'space-')).toBe('cooking')
    })

    it('handles names without hyphens', () => {
      expect(toNamespaceId('advisor')).toBe('advisor')
    })

    it('handles prefix that does not match', () => {
      expect(toNamespaceId('general-advisor', 'agent-')).toBe('general_advisor')
    })

    it('handles multiple hyphens', () => {
      expect(toNamespaceId('my-multi-word-name')).toBe('my_multi_word_name')
    })
  })

  describe('readSpaceDependencies', () => {
    it('parses package.json spaces field from real cooking space', () => {
      const deps = readSpaceDependencies(FIXTURES_DIR)

      expect(deps.size).toBe(3)
      expect(deps.has('npm:@lmthing/space/french-cooking')).toBe(true)
      expect(deps.has('github:lmthing/space/italian-cooking')).toBe(true)
      expect(deps.has('../../packages/space/space')).toBe(true)
    })

    it('extracts correct namespace names from npm URIs', () => {
      const deps = readSpaceDependencies(FIXTURES_DIR)
      const npmDep = deps.get('npm:@lmthing/space/french-cooking')!
      expect(npmDep.namespaceName).toBe('french_cooking')
    })

    it('extracts correct namespace names from github URIs', () => {
      const deps = readSpaceDependencies(FIXTURES_DIR)
      const ghDep = deps.get('github:lmthing/space/italian-cooking')!
      expect(ghDep.namespaceName).toBe('italian_cooking')
    })

    it('sets spaceDir to null for npm URIs', () => {
      const deps = readSpaceDependencies(FIXTURES_DIR)
      const npmDep = deps.get('npm:@lmthing/space/french-cooking')!
      expect(npmDep.spaceDir).toBeNull()
    })

    it('sets spaceDir to null for github URIs', () => {
      const deps = readSpaceDependencies(FIXTURES_DIR)
      const ghDep = deps.get('github:lmthing/space/italian-cooking')!
      expect(ghDep.spaceDir).toBeNull()
    })

    it('returns empty map for directory without package.json', () => {
      const deps = readSpaceDependencies('/tmp/nonexistent-dir-xyz')
      expect(deps.size).toBe(0)
    })
  })

  describe('extractParamSchema', () => {
    it('extracts domains and fields from knowledge defaults', () => {
      const defaults: Record<string, any> = {
        cuisine: { type: 'italian' },
        technique: true,
      }
      const schema = extractParamSchema(defaults)

      expect(schema.domains.cuisine).toBeDefined()
      expect(schema.domains.cuisine.fields.type).toBeDefined()
      expect(schema.domains.cuisine.fields.type.optional).toBe(true)
    })

    it('excludes hidden fields (false values)', () => {
      const defaults: Record<string, any> = {
        dietary: { restrictions: false },
        cuisine: { type: 'italian' },
      }
      const schema = extractParamSchema(defaults)

      // dietary domain should be empty (only had hidden field)
      expect(schema.domains.dietary).toBeUndefined()
      expect(schema.domains.cuisine).toBeDefined()
    })

    it('includes enum values from knowledge tree', () => {
      const defaults: Record<string, any> = {
        cuisine: { type: 'italian' },
      }
      const tree: KnowledgeTree = {
        name: 'cooking',
        domains: [{
          slug: 'cuisine',
          label: 'Cuisine',
          description: '',
          icon: '',
          color: '',
          fields: [{
            slug: 'type',
            label: 'Type',
            description: '',
            fieldType: 'select',
            required: false,
            variableName: 'cuisineType',
            options: [
              { slug: 'italian', title: 'Italian', description: '', order: 1 },
              { slug: 'japanese', title: 'Japanese', description: '', order: 2 },
              { slug: 'mexican', title: 'Mexican', description: '', order: 3 },
            ],
          }],
        }],
      }
      const schema = extractParamSchema(defaults, tree)

      expect(schema.domains.cuisine.fields.type.enum).toEqual([
        'italian', 'japanese', 'mexican',
      ])
    })

    it('handles empty knowledge defaults', () => {
      const schema = extractParamSchema({})
      expect(Object.keys(schema.domains)).toHaveLength(0)
    })

    it('handles true value for entire domain (all fields available)', () => {
      // When value is `true`, it means the domain is enabled but has no sub-field filtering
      // Since true is not an object, it gets skipped at the top level
      const defaults: Record<string, any> = {
        technique: true,
      }
      const schema = extractParamSchema(defaults)
      // true at domain level isn't an object, so no fields extracted
      expect(schema.domains.technique).toBeUndefined()
    })
  })

  describe('buildSpaceAgentTrees', () => {
    it('builds agent tree from real cooking space', () => {
      const knowledgeTrees: KnowledgeTree[] = [{
        name: 'cooking',
        domains: [],
      }]

      const trees = buildSpaceAgentTrees([FIXTURES_DIR], knowledgeTrees)

      expect(trees).toHaveLength(1)
      expect(trees[0].spaceName).toBe('cooking_demo')
      expect(trees[0].agents.length).toBeGreaterThan(0)

      // Check general-advisor agent was loaded
      const advisor = trees[0].agents.find(a => a.rawSlug === 'general-advisor')
      expect(advisor).toBeDefined()
      expect(advisor!.slug).toBe('general_advisor')
      expect(advisor!.title).toBe('Food Assistant')
      expect(advisor!.actions).toHaveLength(1)
      expect(advisor!.actions[0].id).toBe('mealplan')
    })

    it('reads dependencies from package.json even when no agent enables them', () => {
      const knowledgeTrees: KnowledgeTree[] = [{
        name: 'cooking',
        domains: [],
      }]

      const trees = buildSpaceAgentTrees([FIXTURES_DIR], knowledgeTrees)

      // The cooking space's general-advisor doesn't declare "agents" in config.json,
      // so dependencies won't appear in the tree (they're only included when
      // at least one agent has enabledAgents for that URI)
      // This is correct behavior — unused deps are filtered out
      expect(trees[0].dependencies).toHaveLength(0)
    })

    it('extracts param schema with enum values when knowledge tree provided', () => {
      const knowledgeTrees: KnowledgeTree[] = [{
        name: 'cooking',
        domains: [{
          slug: 'cuisine',
          label: 'Cuisine',
          description: '',
          icon: '',
          color: '',
          fields: [{
            slug: 'type',
            label: 'Type',
            description: '',
            fieldType: 'select',
            required: false,
            variableName: 'cuisineType',
            options: [
              { slug: 'italian', title: 'Italian', description: '', order: 1 },
              { slug: 'japanese', title: 'Japanese', description: '', order: 2 },
            ],
          }],
        }],
      }]

      const trees = buildSpaceAgentTrees([FIXTURES_DIR], knowledgeTrees)
      const advisor = trees[0].agents.find(a => a.rawSlug === 'general-advisor')!
      const cuisineDomain = advisor.paramSchema.domains.cuisine

      expect(cuisineDomain).toBeDefined()
      expect(cuisineDomain.fields.type.enum).toContain('italian')
      expect(cuisineDomain.fields.type.enum).toContain('japanese')
    })
  })

  describe('createNamespaceGlobals', () => {
    it('creates namespace object with agent callable', () => {
      const onSpawn = vi.fn().mockResolvedValue(makeSpawnResult())
      const tree = makeTree()
      const globals = createNamespaceGlobals([tree], onSpawn)

      expect(globals.test_space).toBeDefined()
      const ns = globals.test_space as Record<string, any>
      expect(typeof ns.test_agent).toBe('function')
    })

    it('agent callable returns action methods', () => {
      const onSpawn = vi.fn().mockResolvedValue(makeSpawnResult())
      const tree = makeTree()
      const globals = createNamespaceGlobals([tree], onSpawn)

      const ns = globals.test_space as Record<string, any>
      const actions = ns.test_agent({})
      expect(typeof actions.run).toBe('function')
    })

    it('action method returns a thenable (ChainableSpawnPromise)', async () => {
      const onSpawn = vi.fn().mockResolvedValue(makeSpawnResult())
      const tree = makeTree()
      const globals = createNamespaceGlobals([tree], onSpawn)

      const ns = globals.test_space as Record<string, any>
      const promise = ns.test_agent({}).run('do something')
      expect(typeof promise.then).toBe('function')

      const result = await promise
      expect(result.result).toEqual({ answer: 42 })
    })

    it('passes correct config to onSpawn', async () => {
      const onSpawn = vi.fn().mockResolvedValue(makeSpawnResult())
      const tree = makeTree()
      const globals = createNamespaceGlobals([tree], onSpawn)

      const ns = globals.test_space as Record<string, any>
      await ns.test_agent({ cuisine: 'italian' }).run('make pasta')

      expect(onSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceDir: '/tmp/test-space',
          spaceName: 'test_space',
          agentSlug: 'test-agent',
          actionId: 'run',
          request: 'make pasta',
          params: { cuisine: 'italian' },
          options: { context: 'empty' },
        }),
      )
    })

    it('nested dependency agents are accessible', async () => {
      const onSpawn = vi.fn().mockResolvedValue(makeSpawnResult())
      const depAgent = makeAgentEntry({ slug: 'chef', rawSlug: 'chef' })
      const tree = makeTree({
        dependencies: [{
          namespaceName: 'french_cooking',
          uri: 'npm:french-cooking',
          spaceDir: '/tmp/french-space',
          agents: [depAgent],
        }],
      })
      const globals = createNamespaceGlobals([tree], onSpawn)

      const ns = globals.test_space as Record<string, any>
      expect(ns.french_cooking).toBeDefined()
      expect(typeof ns.french_cooking.chef).toBe('function')

      const result = await ns.french_cooking.chef({}).run('bouillabaisse')
      expect(result.result).toEqual({ answer: 42 })
    })

    it('skips unresolvable dependencies (null spaceDir)', () => {
      const onSpawn = vi.fn()
      const tree = makeTree({
        dependencies: [{
          namespaceName: 'unresolvable',
          uri: 'npm:unknown',
          spaceDir: null,
          agents: [],
        }],
      })
      const globals = createNamespaceGlobals([tree], onSpawn)
      const ns = globals.test_space as Record<string, any>
      // Should not have unresolvable namespace
      expect(ns.unresolvable).toBeUndefined()
    })

    it('default params is empty object', async () => {
      const onSpawn = vi.fn().mockResolvedValue(makeSpawnResult())
      const tree = makeTree()
      const globals = createNamespaceGlobals([tree], onSpawn)

      const ns = globals.test_space as Record<string, any>
      await ns.test_agent().run('test')

      expect(onSpawn).toHaveBeenCalledWith(
        expect.objectContaining({ params: {} }),
      )
    })
  })

  describe('ChainableSpawnPromise', () => {
    it('resolves with SpawnResult', async () => {
      const expected = makeSpawnResult()
      const onSpawn = vi.fn().mockResolvedValue(expected)
      const config: AgentSpawnConfig = {
        spaceDir: '/tmp',
        spaceName: 'test',
        agentSlug: 'agent',
        actionId: 'act',
        request: 'do it',
        params: {},
        options: { context: 'empty' },
      }

      const promise = new ChainableSpawnPromise(onSpawn, config)
      const result = await promise

      expect(result).toEqual(expected)
      expect(onSpawn).toHaveBeenCalledWith(config)
    })

    it('.options() modifies context before start', async () => {
      const onSpawn = vi.fn().mockResolvedValue(makeSpawnResult())
      const config: AgentSpawnConfig = {
        spaceDir: '/tmp',
        spaceName: 'test',
        agentSlug: 'agent',
        actionId: 'act',
        request: 'do it',
        params: {},
        options: { context: 'empty' },
      }

      const promise = new ChainableSpawnPromise(onSpawn, config)
        .options({ context: 'branch' })

      await promise

      expect(onSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { context: 'branch' },
        }),
      )
    })

    it('rejects when onSpawn throws', async () => {
      const onSpawn = vi.fn().mockRejectedValue(new Error('spawn failed'))
      const config: AgentSpawnConfig = {
        spaceDir: '/tmp',
        spaceName: 'test',
        agentSlug: 'agent',
        actionId: 'act',
        request: 'do it',
        params: {},
        options: { context: 'empty' },
      }

      const promise = new ChainableSpawnPromise(onSpawn, config)

      await expect(promise).rejects.toThrow('spawn failed')
    })

    it('.catch() handles rejections', async () => {
      const onSpawn = vi.fn().mockRejectedValue(new Error('boom'))
      const config: AgentSpawnConfig = {
        spaceDir: '/tmp',
        spaceName: 'test',
        agentSlug: 'agent',
        actionId: 'act',
        request: 'do it',
        params: {},
        options: { context: 'empty' },
      }

      const promise = new ChainableSpawnPromise(onSpawn, config)
      const caught = await promise.catch(e => e.message)
      expect(caught).toBe('boom')
    })

    it('.finally() is called on success', async () => {
      const onSpawn = vi.fn().mockResolvedValue(makeSpawnResult())
      const config: AgentSpawnConfig = {
        spaceDir: '/tmp',
        spaceName: 'test',
        agentSlug: 'agent',
        actionId: 'act',
        request: 'do it',
        params: {},
        options: { context: 'empty' },
      }

      const finallyCb = vi.fn()
      await new ChainableSpawnPromise(onSpawn, config).finally(finallyCb)
      expect(finallyCb).toHaveBeenCalled()
    })

    it('.finally() is called on failure', async () => {
      const onSpawn = vi.fn().mockRejectedValue(new Error('fail'))
      const config: AgentSpawnConfig = {
        spaceDir: '/tmp',
        spaceName: 'test',
        agentSlug: 'agent',
        actionId: 'act',
        request: 'do it',
        params: {},
        options: { context: 'empty' },
      }

      const finallyCb = vi.fn()
      await new ChainableSpawnPromise(onSpawn, config)
        .finally(finallyCb)
        .catch(() => {}) // prevent unhandled rejection
      expect(finallyCb).toHaveBeenCalled()
    })

    it('is usable with await (PromiseLike)', async () => {
      const onSpawn = vi.fn().mockResolvedValue(makeSpawnResult())
      const config: AgentSpawnConfig = {
        spaceDir: '/tmp',
        spaceName: 'test',
        agentSlug: 'agent',
        actionId: 'act',
        request: 'do it',
        params: {},
        options: { context: 'empty' },
      }

      const result = await new ChainableSpawnPromise(onSpawn, config)
      expect(result.scope).toEqual({ summary: 'done' })
    })
  })

  describe('formatAgentTreeForPrompt', () => {
    it('formats own agents correctly', () => {
      const tree = makeTree({
        spaceName: 'cooking',
        agents: [makeAgentEntry({
          slug: 'general_advisor',
          rawSlug: 'general-advisor',
          actions: [
            { id: 'mealplan', label: 'Meal Plan', description: 'Plan meals', flow: 'meal_plan' },
          ],
        })],
      })

      const output = formatAgentTreeForPrompt([tree])

      expect(output).toContain('cooking {')
      expect(output).toContain('general_advisor(')
      expect(output).toContain('mealplan(request: string): Promise<SpawnResult>;')
      expect(output).toContain('}')
    })

    it('formats dependency agents nested under parent', () => {
      const tree = makeTree({
        spaceName: 'cooking',
        dependencies: [{
          namespaceName: 'french_cooking',
          uri: 'npm:french-cooking',
          spaceDir: '/tmp/french',
          agents: [makeAgentEntry({
            slug: 'chef',
            rawSlug: 'chef',
            actions: [
              { id: 'recipe', label: 'Recipe', description: 'Make recipe', flow: 'flow_recipe' },
            ],
          })],
        }],
      })

      const output = formatAgentTreeForPrompt([tree])

      expect(output).toContain('cooking {')
      expect(output).toContain('french_cooking {')
      expect(output).toContain('chef(')
      expect(output).toContain('recipe(request: string): Promise<SpawnResult>;')
    })

    it('shows unresolvable dependencies with comment', () => {
      const tree = makeTree({
        spaceName: 'cooking',
        agents: [],
        dependencies: [{
          namespaceName: 'missing_space',
          uri: 'npm:@scope/missing',
          spaceDir: null,
          agents: [],
        }],
      })

      const output = formatAgentTreeForPrompt([tree])
      expect(output).toContain('missing_space { /* unresolvable: npm:@scope/missing */ }')
    })

    it('includes param schema in output', () => {
      const tree = makeTree({
        spaceName: 'cooking',
        agents: [makeAgentEntry({
          slug: 'advisor',
          paramSchema: {
            domains: {
              cuisine: {
                fields: {
                  type: { optional: true, enum: ['italian', 'japanese'] },
                },
              },
            },
          },
        })],
      })

      const output = formatAgentTreeForPrompt([tree])
      expect(output).toContain("cuisine?: { type?: 'italian' | 'japanese' }")
    })

    it('formats empty params as {}', () => {
      const tree = makeTree({
        spaceName: 'cooking',
        agents: [makeAgentEntry({
          slug: 'simple',
          paramSchema: { domains: {} },
        })],
      })

      const output = formatAgentTreeForPrompt([tree])
      expect(output).toContain('simple({})')
    })

    it('formats multiple spaces', () => {
      const trees = [
        makeTree({ spaceName: 'cooking' }),
        makeTree({ spaceName: 'nutrition' }),
      ]

      const output = formatAgentTreeForPrompt(trees)
      expect(output).toContain('cooking {')
      expect(output).toContain('nutrition {')
    })
  })

  describe('agent enabledAgents filtering', () => {
    it('only includes dependency agents that are enabled by at least one agent', () => {
      // This test uses the real cooking space fixture
      // The cooking agent config.json does NOT have an "agents" field,
      // so enabledAgents should be empty, meaning no dependency agents are loaded
      const knowledgeTrees: KnowledgeTree[] = [{
        name: 'cooking',
        domains: [],
      }]

      const trees = buildSpaceAgentTrees([FIXTURES_DIR], knowledgeTrees)

      // Since general-advisor doesn't declare "agents" in config.json,
      // no dependency agents should be included
      for (const dep of trees[0].dependencies) {
        expect(dep.agents).toHaveLength(0)
      }
    })
  })

  describe('integration: real cooking space', () => {
    it('builds complete tree from cooking space', () => {
      const knowledgeTrees: KnowledgeTree[] = [{
        name: 'cooking',
        domains: [{
          slug: 'cuisine',
          label: 'Cuisine',
          description: 'World cuisines',
          icon: '',
          color: '',
          fields: [{
            slug: 'type',
            label: 'Type',
            description: '',
            fieldType: 'select',
            required: false,
            variableName: 'cuisineType',
            options: [
              { slug: 'italian', title: 'Italian', description: '', order: 1 },
              { slug: 'japanese', title: 'Japanese', description: '', order: 2 },
              { slug: 'mexican', title: 'Mexican', description: '', order: 3 },
            ],
          }],
        }, {
          slug: 'technique',
          label: 'Technique',
          description: 'Cooking techniques',
          icon: '',
          color: '',
          fields: [{
            slug: 'method',
            label: 'Method',
            description: '',
            fieldType: 'select',
            required: false,
            variableName: 'technique',
            options: [
              { slug: 'saute', title: 'Saute', description: '', order: 1 },
              { slug: 'grill', title: 'Grill', description: '', order: 2 },
              { slug: 'braise', title: 'Braise', description: '', order: 3 },
            ],
          }],
        }],
      }]

      const trees = buildSpaceAgentTrees([FIXTURES_DIR], knowledgeTrees)
      const tree = trees[0]

      // Has the general-advisor agent
      const advisor = tree.agents.find(a => a.slug === 'general_advisor')!
      expect(advisor).toBeDefined()
      expect(advisor.actions[0].id).toBe('mealplan')

      // Param schema includes cuisine and technique
      expect(advisor.paramSchema.domains.cuisine).toBeDefined()
      expect(advisor.paramSchema.domains.cuisine.fields.type.enum).toEqual([
        'italian', 'japanese', 'mexican',
      ])

      // Format for prompt
      const output = formatAgentTreeForPrompt(trees)
      expect(output).toContain('cooking_demo {')
      expect(output).toContain('general_advisor(')
      expect(output).toContain('mealplan(request: string)')
    })

    it('creates callable namespace globals from cooking space', async () => {
      const knowledgeTrees: KnowledgeTree[] = [{
        name: 'cooking',
        domains: [],
      }]

      const trees = buildSpaceAgentTrees([FIXTURES_DIR], knowledgeTrees)
      const onSpawn = vi.fn().mockResolvedValue(makeSpawnResult())
      const globals = createNamespaceGlobals(trees, onSpawn)

      // Should have cooking_demo namespace
      const ns = globals.cooking_demo as Record<string, any>
      expect(ns).toBeDefined()
      expect(typeof ns.general_advisor).toBe('function')

      // Call it
      const result = await ns.general_advisor({ cuisine: { type: 'italian' } }).mealplan('steak recipe')

      expect(onSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceDir: FIXTURES_DIR,
          spaceName: 'cooking_demo',
          agentSlug: 'general-advisor',
          actionId: 'mealplan',
          request: 'steak recipe',
          params: { cuisine: { type: 'italian' } },
          options: { context: 'empty' },
        }),
      )
      expect(result.result).toEqual({ answer: 42 })
    })

    it('supports .options({ context: "branch" }) chaining', async () => {
      const knowledgeTrees: KnowledgeTree[] = [{
        name: 'cooking',
        domains: [],
      }]

      const trees = buildSpaceAgentTrees([FIXTURES_DIR], knowledgeTrees)
      const onSpawn = vi.fn().mockResolvedValue(makeSpawnResult())
      const globals = createNamespaceGlobals(trees, onSpawn)

      const ns = globals.cooking_demo as Record<string, any>
      await ns.general_advisor({}).mealplan('improve').options({ context: 'branch' })

      expect(onSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { context: 'branch' },
        }),
      )
    })
  })
})
