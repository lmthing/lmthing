// src/lib/fs/parsers/tasklist.test.ts

import { describe, it, expect } from 'vitest'
import {
  parseTasklistTask,
  serializeTasklistTask,
  parseTasklistIndex,
  serializeTasklistIndex,
  tasklistTaskFilename,
  type TasklistTask,
  type TasklistIndex,
} from './tasklist'

// ---------------------------------------------------------------------------
// parseTasklistTask / serializeTasklistTask
// ---------------------------------------------------------------------------

describe('tasklist parser', () => {
  describe('parseTasklistTask', () => {
    it('parses minimal task (no input)', () => {
      const content = `---
id: boil_water
output:
  water_ready: boolean
dependsOn: []
optional: false
goal: false
---

Fill a pot with water and bring to a boil.`

      const task = parseTasklistTask('01-boil_water.md', content)

      expect(task.order).toBe(1)
      expect(task.id).toBe('boil_water')
      expect(task.instruction).toBe('Fill a pot with water and bring to a boil.')
      expect(task.output).toEqual({ water_ready: 'boolean' })
      expect(task.input).toBeUndefined()
      expect(task.dependsOn).toBeUndefined()
      expect(task.optional).toBeFalsy()
      expect(task.goal).toBeFalsy()
    })

    it('parses task with input field', () => {
      const content = `---
id: boil_water
input:
  pot_size: number
output:
  water_ready: boolean
  temperature: number
dependsOn: []
optional: false
goal: false
---

Fill a large pot with water, add salt, and bring to a boil.`

      const task = parseTasklistTask('01-boil_water.md', content)

      expect(task.input).toEqual({ pot_size: 'number' })
      expect(task.output).toEqual({ water_ready: 'boolean', temperature: 'number' })
    })

    it('parses task with multiple input fields', () => {
      const content = `---
id: add_pasta
input:
  water_temp: number
  pasta_type: string
output:
  pasta_done: boolean
dependsOn: []
optional: false
goal: false
---

Add pasta once water is boiling.`

      const task = parseTasklistTask('02-add_pasta.md', content)

      expect(task.input).toEqual({ water_temp: 'number', pasta_type: 'string' })
    })

    it('parses dependsOn array', () => {
      const content = `---
id: check_done
output:
  done: boolean
dependsOn:
  - boil_water
  - add_pasta
optional: false
goal: true
---

Check if pasta is done.`

      const task = parseTasklistTask('03-check_done.md', content)

      expect(task.dependsOn).toEqual(['boil_water', 'add_pasta'])
      expect(task.goal).toBe(true)
    })

    it('parses optional and condition fields', () => {
      const content = `---
id: add_salt
output:
  salt_added: boolean
optional: true
goal: false
condition: "some_var === true"
---

Add salt if desired.`

      const task = parseTasklistTask('04-add_salt.md', content)

      expect(task.optional).toBe(true)
      expect(task.condition).toBe('some_var === true')
    })

    it('derives order and id from filename', () => {
      const content = `---\noutput:\n  result: string\n---\n\nDo stuff.`
      const task = parseTasklistTask('07-my_task.md', content)
      expect(task.order).toBe(7)
      expect(task.id).toBe('my_task')
    })

    it('handles underscore separator in filename', () => {
      const content = `---\noutput:\n  result: string\n---\n\nDo stuff.`
      const task = parseTasklistTask('03_my_task.md', content)
      expect(task.order).toBe(3)
      expect(task.id).toBe('my_task')
    })

    it('omits input when frontmatter input is absent', () => {
      const content = `---\nid: t\noutput:\n  x: string\n---\n\nBody.`
      const task = parseTasklistTask('01-t.md', content)
      expect('input' in task).toBe(false)
    })
  })

  describe('serializeTasklistTask', () => {
    it('serializes task without input', () => {
      const task: TasklistTask = {
        order: 1,
        id: 'boil_water',
        instruction: 'Fill a pot with water.',
        output: { water_ready: 'boolean' },
      }

      const result = serializeTasklistTask(task)

      expect(result).toContain('id: boil_water')
      expect(result).toContain('output:')
      expect(result).toContain('  water_ready: boolean')
      expect(result).not.toContain('input:')
      expect(result).toContain('Fill a pot with water.')
    })

    it('serializes task with input before output', () => {
      const task: TasklistTask = {
        order: 1,
        id: 'boil_water',
        instruction: 'Fill a pot.',
        input: { pot_size: 'number' },
        output: { water_ready: 'boolean' },
      }

      const result = serializeTasklistTask(task)

      expect(result).toContain('input:')
      expect(result).toContain('  pot_size: number')

      // input must appear before output in the serialized form
      const inputPos = result.indexOf('input:')
      const outputPos = result.indexOf('output:')
      expect(inputPos).toBeLessThan(outputPos)
    })

    it('does not emit input block when input is empty', () => {
      const task: TasklistTask = {
        order: 1,
        id: 't',
        instruction: 'Body.',
        input: {},
        output: { result: 'string' },
      }

      const result = serializeTasklistTask(task)
      expect(result).not.toContain('input:')
    })

    it('serializes dependsOn as block list', () => {
      const task: TasklistTask = {
        order: 3,
        id: 'check_done',
        instruction: 'Check.',
        output: { done: 'boolean' },
        dependsOn: ['boil_water', 'add_pasta'],
        goal: true,
      }

      const result = serializeTasklistTask(task)
      expect(result).toContain('dependsOn:\n  - boil_water\n  - add_pasta')
    })

    it('round-trips all fields', () => {
      const original: TasklistTask = {
        order: 1,
        id: 'boil_water',
        instruction: 'Fill a large pot with water, add salt, and bring to a boil.',
        input: { pot_size: 'number', water_amount: 'string' },
        output: { water_ready: 'boolean', temperature: 'number' },
        dependsOn: ['prep_step'],
        optional: false,
        goal: true,
        condition: 'pot_ready === true',
      }

      const serialized = serializeTasklistTask(original)
      const reparsed = parseTasklistTask('01-boil_water.md', serialized)

      expect(reparsed.id).toBe(original.id)
      expect(reparsed.instruction).toBe(original.instruction)
      expect(reparsed.input).toEqual(original.input)
      expect(reparsed.output).toEqual(original.output)
      expect(reparsed.dependsOn).toEqual(original.dependsOn)
      expect(reparsed.optional).toBe(original.optional || false)
      expect(reparsed.goal).toBe(original.goal)
      expect(reparsed.condition).toBe(original.condition)
    })
  })

  describe('tasklistTaskFilename', () => {
    it('builds zero-padded filename', () => {
      expect(tasklistTaskFilename(1, 'boil_water')).toBe('01-boil_water.md')
      expect(tasklistTaskFilename(10, 'add_pasta')).toBe('10-add_pasta.md')
    })
  })

  // ---------------------------------------------------------------------------
  // parseTasklistIndex / serializeTasklistIndex
  // ---------------------------------------------------------------------------

  describe('parseTasklistIndex', () => {
    it('parses index with input and description', () => {
      const content = `---
input:
  dish: string
  servings: number
---

Cook a full pasta dish end to end. Use when the user wants a complete recipe executed.`

      const index = parseTasklistIndex(content)

      expect(index.input).toEqual({ dish: 'string', servings: 'number' })
      expect(index.description).toContain('Cook a full pasta dish')
    })

    it('parses index without input field', () => {
      const content = `---\n---\n\nJust a description.`

      const index = parseTasklistIndex(content)

      expect(index.input).toBeUndefined()
      expect(index.description).toBe('Just a description.')
    })

    it('parses index with only description body (no frontmatter)', () => {
      const content = 'Just a description with no frontmatter.'

      const index = parseTasklistIndex(content)

      expect(index.input).toBeUndefined()
      expect(index.description).toBe('Just a description with no frontmatter.')
    })

    it('excludes empty input from result', () => {
      const content = `---\ninput: {}\n---\n\nDescription.`

      // parseFrontmatter will likely parse `input: {}` as an empty object
      // parseOutputOptional returns undefined for empty objects
      const index = parseTasklistIndex(content)
      // input may be undefined or empty — either way it should not have keys
      if (index.input !== undefined) {
        expect(Object.keys(index.input)).toHaveLength(0)
      }
    })

    it('round-trips correctly', () => {
      const original: TasklistIndex = {
        input: { dish: 'string', servings: 'number' },
        description: 'Cook a full pasta dish end to end.',
      }

      const serialized = serializeTasklistIndex(original, original.description)
      const reparsed = parseTasklistIndex(serialized)

      expect(reparsed.input).toEqual(original.input)
      expect(reparsed.description).toBe(original.description)
    })
  })

  describe('serializeTasklistIndex', () => {
    it('serializes with input block', () => {
      const index: TasklistIndex = {
        input: { dish: 'string', servings: 'number' },
        description: 'Cook pasta.',
      }

      const result = serializeTasklistIndex(index, 'Cook pasta.')

      expect(result).toContain('input:')
      expect(result).toContain('  dish: string')
      expect(result).toContain('  servings: number')
      expect(result).toContain('Cook pasta.')
    })

    it('emits skeleton frontmatter even when no input', () => {
      const index: TasklistIndex = { description: 'No input here.' }

      const result = serializeTasklistIndex(index, 'No input here.')

      // Must still start with frontmatter
      expect(result.startsWith('---')).toBe(true)
      expect(result).toContain('No input here.')
      expect(result).not.toContain('input:')
    })

    it('does not emit input block when input is empty object', () => {
      const index: TasklistIndex = { input: {}, description: '' }

      const result = serializeTasklistIndex(index, '')
      expect(result).not.toContain('input:')
    })
  })
})
