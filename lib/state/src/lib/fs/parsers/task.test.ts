// src/lib/fs/parsers/task.test.ts

import { describe, it, expect } from 'vitest'
import {
  parseFlowTask,
  serializeFlowTask,
  parseFlowIndex,
  serializeFlowIndex,
  type FlowTask
} from './task'

describe('task parser', () => {
  describe('parseFlowTask', () => {
    it('should parse basic task', () => {
      const content = `---
name: Task One
---
Task instructions here`

      const result = parseFlowTask(content)

      expect(result.name).toBe('Task One')
      expect(result.content).toBe('Task instructions here')
    })

    it('should parse all fields', () => {
      const content = `---
name: Complex Task
description: A complex task
agent: bot-1
inputs: {key: value}
outputs: {result: output}
---
Do the work`

      const result = parseFlowTask(content)

      expect(result.name).toBe('Complex Task')
      expect(result.description).toBe('A complex task')
      expect(result.agent).toBe('bot-1')
      expect(result.inputs).toEqual({ key: 'value' })
      expect(result.outputs).toEqual({ result: 'output' })
      expect(result.content).toBe('Do the work')
    })

    it('should handle content without frontmatter', () => {
      const content = 'Just task content'

      const result = parseFlowTask(content)

      expect(result.name).toBe('')
      expect(result.content).toBe('Just task content')
    })

    it('should preserve multi-line content', () => {
      const content = `---
name: Task
---
Step 1
Step 2
Step 3`

      const result = parseFlowTask(content)

      expect(result.content).toBe('Step 1\nStep 2\nStep 3')
    })
  })

  describe('serializeFlowTask', () => {
    it('should serialize basic task', () => {
      const task: FlowTask = {
        name: 'Task One',
        content: 'Instructions'
      }

      const result = serializeFlowTask(task)

      expect(result).toContain('---')
      expect(result).toContain('name: "Task One"')
      expect(result).toContain('---')
      expect(result).toContain('Instructions')
    })

    it('should serialize all fields', () => {
      const task: FlowTask = {
        name: 'Task',
        description: 'Description',
        agent: 'bot',
        inputs: { key: 'value' },
        outputs: { result: 'output' },
        content: 'Content'
      }

      const result = serializeFlowTask(task)

      expect(result).toContain('name: Task')
      expect(result).toContain('description: Description')
      expect(result).toContain('agent: bot')
    })

    it('should round-trip correctly', () => {
      const original = `---
name: Test Task
---
Task content`

      const parsed = parseFlowTask(original)
      const serialized = serializeFlowTask(parsed)
      const reparsed = parseFlowTask(serialized)

      expect(reparsed.name).toBe(parsed.name)
      expect(reparsed.content).toBe(parsed.content)
    })
  })

  describe('parseFlowIndex', () => {
    it('should parse basic index', () => {
      const content = `---
name: My Flow
---
- [Step One](01.step-one.md)
- [Step Two](02.step-two.md)`

      const result = parseFlowIndex(content)

      expect(result.name).toBe('My Flow')
      expect(result.tasks).toEqual(['01.step-one.md', '02.step-two.md'])
    })

    it('should parse with description', () => {
      const content = `---
name: My Flow
description: A test flow
---
- [Task](01.task.md)`

      const result = parseFlowIndex(content)

      expect(result.description).toBe('A test flow')
    })

    it('should handle content without frontmatter', () => {
      const content = `- [Task](01.task.md)`

      const result = parseFlowIndex(content)

      expect(result.name).toBe('')
      expect(result.tasks).toEqual(['01.task.md'])
    })

    it('should parse tasks from markdown links', () => {
      const content = `---
name: Flow
---
- [First Task](01.first.md)
- [Second Task](02.second.md)
- [Third Task](03.third.md)`

      const result = parseFlowIndex(content)

      expect(result.tasks).toHaveLength(3)
      expect(result.tasks).toContain('01.first.md')
      expect(result.tasks).toContain('02.second.md')
      expect(result.tasks).toContain('03.third.md')
    })

    it('should handle empty task list', () => {
      const content = `---
name: Empty Flow
---
`

      const result = parseFlowIndex(content)

      expect(result.tasks).toEqual([])
    })
  })

  describe('serializeFlowIndex', () => {
    it('should serialize basic index', () => {
      const index = {
        name: 'My Flow',
        tasks: ['01.task.md', '02.task.md']
      }

      const result = serializeFlowIndex(index)

      expect(result).toContain('---')
      expect(result).toContain('name: "My Flow"')
      expect(result).toContain('---')
      expect(result).toContain('- [Task](01.task.md)')
      expect(result).toContain('- [Task](02.task.md)')
    })

    it('should serialize with description', () => {
      const index = {
        name: 'Flow',
        description: 'A flow',
        tasks: []
      }

      const result = serializeFlowIndex(index)

      expect(result).toContain('description: "A flow"')
    })

    it('should convert task filenames to readable names', () => {
      const index = {
        name: 'Flow',
        tasks: ['01.step-one.md', '02.step-two.md']
      }

      const result = serializeFlowIndex(index)

      expect(result).toContain('[Step One](01.step-one.md)')
      expect(result).toContain('[Step Two](02.step-two.md)')
    })

    it('should round-trip correctly', () => {
      const original = `---
name: Test Flow
---
- [Task One](01.task-one.md)
- [Task Two](02.task-two.md)`

      const parsed = parseFlowIndex(original)
      const serialized = serializeFlowIndex(parsed)
      const reparsed = parseFlowIndex(serialized)

      expect(reparsed.name).toBe(parsed.name)
      expect(reparsed.tasks).toEqual(parsed.tasks)
    })
  })
})
