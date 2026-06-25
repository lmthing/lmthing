/**
 * Round-trip test: extractWorkspaceData(serialize(space)) === space
 *
 * Uses a representative new-spec space:
 *   - 1 agent with 2 actions, functions, components, canDelegateTo, knowledge refs
 *   - 1 tasklist (make_pasta) with 3 tasks including a DAG dependency, a goal, an
 *     index.md input schema + description, and Task.input
 *   - 1 knowledge domain (with renderAs) with 1 field and 2 options
 *   - 1 function file
 *   - 1 view component + 1 single-file form component
 */

import { describe, it, expect } from 'vitest'
import type { SpaceData } from '@/types/space-data'
import { extractWorkspaceData } from './extractWorkspaceData'
import { workspaceToFileTreeJson } from './workspaceExport'
import type { FileTreeDirectoryNode, FileTreeNode } from './workspaceExport'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Flatten a FileTreeDirectoryNode into a path→content map */
function flattenTree(tree: FileTreeDirectoryNode): Record<string, string> {
  const result: Record<string, string> = {}
  const visit = (node: FileTreeNode, base: string) => {
    const p = base ? `${base}/${node.name}` : node.name
    if (node.type === 'file') {
      result[p] = node.content
    } else {
      for (const child of node.children) visit(child, p)
    }
  }
  for (const child of tree.children) visit(child, '')
  return result
}

// ── Sample space ─────────────────────────────────────────────────────────────

const SAMPLE_SPACE: SpaceData = {
  id: 'cooking',
  agents: {
    chef: {
      id: 'chef',
      frontmatter: {
        title: 'Chef',
        knowledge: ['cuisine/style'],
        functions: ['addIngredient', 'checkPot'],
        components: ['PotStatus', 'ConfirmDish'],
        actions: [
          {
            id: 'cook_pasta',
            label: 'Cook Pasta',
            description: 'Make a full pasta dish from scratch',
            tasklist: 'make_pasta',
          },
          {
            id: 'suggest_menu',
            label: 'Suggest Menu',
            description: 'Suggest a menu for the week',
            tasklist: 'suggest_menu',
          },
        ],
        defaultAction: 'cook_pasta',
        canDelegateTo: ['sommelier-space/pairing'],
      },
      body: 'You are an expert chef. Help users cook delicious meals.',
      conversations: [],
    },
  },
  tasklists: {
    make_pasta: {
      name: 'make_pasta',
      description: 'Cook a full pasta dish from scratch.',
      input: { servings: 'number' },
      tasks: [
        {
          order: 1,
          id: 'boil_water',
          instruction: 'Fill a large pot with water and bring to a boil.',
          output: { water_ready: 'boolean' },
          input: { servings: 'number' },
        },
        {
          order: 2,
          id: 'cook_pasta',
          instruction: 'Add pasta to boiling water and cook per package directions.',
          output: { pasta_done: 'boolean' },
          dependsOn: ['boil_water'],
        },
        {
          order: 3,
          id: 'combine',
          instruction: 'Combine pasta with sauce. Serve.',
          output: { dish_name: 'string', ready: 'boolean' },
          dependsOn: ['cook_pasta'],
          goal: true,
        },
      ],
    },
  },
  knowledge: {
    cuisine: {
      slug: 'cuisine',
      renderAs: 'tabs',
      fields: {
        style: {
          slug: 'style',
          index: {
            type: 'string',
            variable: 'cuisineStyle',
            default: 'italian',
          },
          description: 'The cuisine style to cook in.',
          options: {
            italian: '# Italian\nFocus on simplicity and fresh ingredients.',
            french: '# French\nFocus on technique and rich sauces.',
          },
        },
      },
    },
  },
  functions: {
    addIngredient: {
      name: 'addIngredient',
      source: 'export function addIngredient(name: string) { return `Added ${name}` }',
    },
  },
  components: {
    view: {
      PotStatus: {
        name: 'PotStatus',
        source: 'export default function PotStatus() { return <div>Pot</div> }',
      },
    },
    form: {
      ConfirmDish: {
        name: 'ConfirmDish',
        source: 'export default function ConfirmDish() { return <form /> }',
      },
    },
  },
  packageJson: { name: 'cooking', version: '1.0.0' },
  env: {},
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('round-trip: extractWorkspaceData ↔ workspaceToFileTreeJson', () => {
  it('serializes and re-parses agent frontmatter correctly', () => {
    const tree = workspaceToFileTreeJson(SAMPLE_SPACE)
    const flat = flattenTree(tree)

    // Paths relative to the space root — strip the leading "cooking/" prefix
    const spaceFlat: Record<string, string> = {}
    for (const [k, v] of Object.entries(flat)) {
      const rel = k.startsWith('cooking/') ? k.slice('cooking/'.length) : k
      spaceFlat[rel] = v
    }

    const roundTripped = extractWorkspaceData('cooking', spaceFlat)

    const agent = roundTripped.agents['chef']
    expect(agent).toBeDefined()
    expect(agent.frontmatter.title).toBe('Chef')
    expect(agent.frontmatter.knowledge).toEqual(['cuisine/style'])
    expect(agent.frontmatter.functions).toEqual(['addIngredient', 'checkPot'])
    expect(agent.frontmatter.components).toEqual(['PotStatus', 'ConfirmDish'])
    expect(agent.frontmatter.defaultAction).toBe('cook_pasta')
    expect(agent.frontmatter.canDelegateTo).toEqual(['sommelier-space/pairing'])
    expect(agent.frontmatter.actions).toHaveLength(2)
    expect(agent.frontmatter.actions[0].id).toBe('cook_pasta')
    expect(agent.frontmatter.actions[0].tasklist).toBe('make_pasta')
    expect(agent.frontmatter.actions[1].id).toBe('suggest_menu')
    expect(agent.body).toContain('expert chef')
  })

  it('serializes and re-parses tasklist tasks correctly', () => {
    const tree = workspaceToFileTreeJson(SAMPLE_SPACE)
    const flat = flattenTree(tree)
    const spaceFlat: Record<string, string> = {}
    for (const [k, v] of Object.entries(flat)) {
      spaceFlat[k.startsWith('cooking/') ? k.slice('cooking/'.length) : k] = v
    }

    const roundTripped = extractWorkspaceData('cooking', spaceFlat)
    const tl = roundTripped.tasklists['make_pasta']

    expect(tl).toBeDefined()
    expect(tl.name).toBe('make_pasta')
    expect(tl.tasks).toHaveLength(3)
    expect(tl.description).toContain('Cook a full pasta dish')
    expect(tl.input).toEqual({ servings: 'number' })

    // tasks are sorted by order, and index.md is excluded from the task list
    const [t1, t2, t3] = tl.tasks
    expect(t1.order).toBe(1)
    expect(t1.id).toBe('boil_water')
    expect(t1.output).toEqual({ water_ready: 'boolean' })
    expect(t1.input).toEqual({ servings: 'number' })
    expect(t1.goal).toBeFalsy()

    expect(t2.order).toBe(2)
    expect(t2.id).toBe('cook_pasta')
    expect(t2.dependsOn).toEqual(['boil_water'])

    expect(t3.order).toBe(3)
    expect(t3.id).toBe('combine')
    expect(t3.goal).toBe(true)
    expect(t3.dependsOn).toEqual(['cook_pasta'])
  })

  it('serializes and re-parses knowledge correctly', () => {
    const tree = workspaceToFileTreeJson(SAMPLE_SPACE)
    const flat = flattenTree(tree)
    const spaceFlat: Record<string, string> = {}
    for (const [k, v] of Object.entries(flat)) {
      spaceFlat[k.startsWith('cooking/') ? k.slice('cooking/'.length) : k] = v
    }

    const roundTripped = extractWorkspaceData('cooking', spaceFlat)
    const domain = roundTripped.knowledge['cuisine']

    expect(domain).toBeDefined()
    expect(domain.slug).toBe('cuisine')
    expect(domain.renderAs).toBe('tabs')

    const field = domain.fields['style']
    expect(field).toBeDefined()
    expect(field.slug).toBe('style')
    expect(field.index.type).toBe('string')
    expect(field.index.variable).toBe('cuisineStyle')
    expect(field.index.default).toBe('italian')
    expect(field.description).toContain('cuisine style')
    expect(Object.keys(field.options)).toContain('italian')
    expect(Object.keys(field.options)).toContain('french')
    expect(field.options['italian']).toContain('Italian')
    expect(field.options['french']).toContain('French')
  })

  it('serializes and re-parses functions and components correctly', () => {
    const tree = workspaceToFileTreeJson(SAMPLE_SPACE)
    const flat = flattenTree(tree)
    const spaceFlat: Record<string, string> = {}
    for (const [k, v] of Object.entries(flat)) {
      spaceFlat[k.startsWith('cooking/') ? k.slice('cooking/'.length) : k] = v
    }

    const roundTripped = extractWorkspaceData('cooking', spaceFlat)

    // function
    expect(roundTripped.functions['addIngredient']).toBeDefined()
    expect(roundTripped.functions['addIngredient'].source).toContain('addIngredient')

    // view component
    expect(roundTripped.components.view['PotStatus']).toBeDefined()
    expect(roundTripped.components.view['PotStatus'].source).toContain('PotStatus')

    // form component (single-file)
    expect(roundTripped.components.form['ConfirmDish']).toBeDefined()
    expect(roundTripped.components.form['ConfirmDish'].source).toContain('form')
    expect(roundTripped.components.form['ConfirmDish']).not.toHaveProperty('web')
    expect(roundTripped.components.form['ConfirmDish']).not.toHaveProperty('ink')
  })

  it('does not emit runtimeFields, formValues, or field-level renderAs', () => {
    const tree = workspaceToFileTreeJson(SAMPLE_SPACE)
    const flat = flattenTree(tree)
    const instructPath = Object.keys(flat).find((p) => p.endsWith('agents/chef/instruct.md'))
    expect(instructPath).toBeDefined()
    const instructContent = flat[instructPath!]
    expect(instructContent).not.toContain('runtimeFields')
    expect(instructContent).not.toContain('formValues')

    const fieldIndexPath = Object.keys(flat).find((p) =>
      p.endsWith('knowledge/cuisine/style/index.md'),
    )
    expect(fieldIndexPath).toBeDefined()
    expect(flat[fieldIndexPath!]).not.toContain('renderAs')

    const domainIndexPath = Object.keys(flat).find((p) => p.endsWith('knowledge/cuisine/index.md'))
    expect(domainIndexPath).toBeDefined()
    expect(flat[domainIndexPath!]).toContain('renderAs: tabs')
  })

  it('ensureGoalTask: flags last task as goal if none set', () => {
    const spaceNoGoal: SpaceData = {
      ...SAMPLE_SPACE,
      id: 'no_goal',
      tasklists: {
        simple: {
          name: 'simple',
          tasks: [
            { order: 1, id: 'step_a', instruction: 'Step A', output: { a: 'string' } },
            { order: 2, id: 'step_b', instruction: 'Step B', output: { b: 'string' } },
          ],
        },
      },
    }

    const tree = workspaceToFileTreeJson(spaceNoGoal)
    const flat = flattenTree(tree)
    const spaceFlat: Record<string, string> = {}
    for (const [k, v] of Object.entries(flat)) {
      spaceFlat[k.startsWith('no_goal/') ? k.slice('no_goal/'.length) : k] = v
    }

    const roundTripped = extractWorkspaceData('no_goal', spaceFlat)
    const tl = roundTripped.tasklists['simple']
    expect(tl.tasks[1].goal).toBe(true) // last task is flagged as goal
    expect(tl.tasks[0].goal).toBeFalsy()
  })
})
