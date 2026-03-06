/**
 * Flow Execution Utilities
 * 
 * Implements flow task execution using lmthing's defTaskList mechanism.
 * Converts flow tasks into lmthing tasks and executes them sequentially.
 */

import { runPrompt } from 'lmthing'
import type { Task as LmthingTask } from 'lmthing/plugins'
import { buildKnowledgeXml } from './buildKnowledgeXml'
import type { KnowledgeNode } from '@/types/space-data'

/**
 * Flow task from the flow-builder section
 */
export interface FlowTask {
  id: string
  flowId?: string
  order: number
  name: string
  description?: string
  type?: 'updateFlowOutput' | 'executeTask'
  model?: string
  temperature?: number
  instructions: string
  outputSchema?: Record<string, unknown>
  targetFieldName?: string
}

/**
 * Flow execution options
 */
export interface FlowExecutionOptions {
  /** Tasks to execute in order */
  tasks: FlowTask[]
  /** System prompt / agent instructions */
  systemPrompt: string
  /** Knowledge data for context */
  knowledge: KnowledgeNode[]
  /** Enabled knowledge file paths */
  enabledFilePaths: string[]
  /** Default model to use if task doesn't specify */
  model: string
  /** Default temperature if task doesn't specify */
  temperature?: number
  /** Callback for task progress updates */
  onTaskProgress?: (taskId: string, status: 'pending' | 'in_progress' | 'completed' | 'failed', result?: unknown) => void
  /** Callback for streaming text updates */
  onStreamUpdate?: (text: string) => void
}

/**
 * Result of flow execution
 */
export interface FlowExecutionResult {
  success: boolean
  flowOutput: Record<string, unknown>
  tasks: LmthingTask[]
  fullText: string
  error?: string
}

/**
 * Converts a flow task to an lmthing task
 */
function convertToLmthingTask(flowTask: FlowTask): LmthingTask {
  return {
    id: flowTask.id,
    name: flowTask.name,
    status: 'pending',
    metadata: {
      order: flowTask.order,
      description: flowTask.description || '',
      type: flowTask.type || 'executeTask',
      instructions: flowTask.instructions,
      outputSchema: flowTask.outputSchema,
      targetFieldName: flowTask.targetFieldName,
      model: flowTask.model,
      temperature: flowTask.temperature,
    }
  }
}

/**
 * Executes a flow using lmthing's defTaskList mechanism
 */
export async function executeFlow(options: FlowExecutionOptions): Promise<FlowExecutionResult> {
  const {
    tasks,
    systemPrompt,
    knowledge,
    enabledFilePaths,
    model,
    temperature = 0.7,
    onTaskProgress,
    onStreamUpdate,
  } = options

  // Sort tasks by order
  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order)
  
  // Convert to lmthing tasks
  const lmthingTasks = sortedTasks.map(convertToLmthingTask)
  
  // Build knowledge XML
  const knowledgeXml = buildKnowledgeXml(knowledge, enabledFilePaths)
  
  // State for flow output accumulation
  const flowOutput: Record<string, unknown> = {}
  
  try {
    const { result } = await runPrompt(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async ({ defTaskList, defSystem, defState, $ }: any) => {
        // Initialize task list
        defTaskList(lmthingTasks)
        
        // Initialize flow output state
        const [output] = defState('flowOutput', {})
        
        // Add system prompt
        defSystem('instructions', systemPrompt)
        
        // Add knowledge XML if available
        if (knowledgeXml) {
          defSystem('knowledge', knowledgeXml)
        }
        
        // Add flow execution instructions
        defSystem('flow-execution', `
You are executing a multi-step flow. Each task must be completed in order.

## Flow Execution Rules
1. Use startTask to begin a task before working on it
2. Execute the task according to its instructions
3. Use completeTask when the task is finished
4. If a task fails, use failTask with a reason

## Task Order
The tasks must be completed in the following order:
${sortedTasks.map(t => `${t.order}. ${t.name} (${t.id})`).join('\n')}

Start with the first pending task and work through them sequentially.
`)
        
        // Start the flow execution
        void $`Begin executing the flow tasks. Start with the first task.`
        
        // Update external flow output with final state
        Object.assign(flowOutput, output)
      },
      {
        model: model as string,
        options: {
          temperature,
          // Handle task progress updates via tool callbacks
          onStepFinish: (event) => {
            if (!onTaskProgress) return
            
            // Check for tool results that indicate task status changes
            const toolResults = event.toolResults || []
            for (const toolResult of toolResults) {
              // Note: toolResult structure may vary by SDK version
              // This is a simplified check that may need adjustment
              if (toolResult.toolName === 'startTask') {
                // Extract task ID from args
                const args = 'args' in toolResult ? (toolResult.args as Record<string, unknown>) : {}
                const taskId = typeof args.taskId === 'string' ? args.taskId : ''
                if (taskId) onTaskProgress(taskId, 'in_progress')
              } else if (toolResult.toolName === 'completeTask') {
                const args = 'args' in toolResult ? (toolResult.args as Record<string, unknown>) : {}
                const taskId = typeof args.taskId === 'string' ? args.taskId : ''
                if (taskId) onTaskProgress(taskId, 'completed')
              } else if (toolResult.toolName === 'failTask') {
                const args = 'args' in toolResult ? (toolResult.args as Record<string, unknown>) : {}
                const taskId = typeof args.taskId === 'string' ? args.taskId : ''
                if (taskId) onTaskProgress(taskId, 'failed')
              }
            }
          }
        }
      }
    )
    
    // Stream text updates
    let fullText = ''
    if (onStreamUpdate) {
      for await (const chunk of result.textStream) {
        fullText += chunk
        onStreamUpdate(fullText)
      }
    } else {
      fullText = await result.text
    }
    
    return {
      success: true,
      flowOutput,
      tasks: lmthingTasks,
      fullText,
    }
  } catch (error) {
    console.error('Flow execution error:', error)
    return {
      success: false,
      flowOutput,
      tasks: lmthingTasks,
      fullText: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Executes a single flow task (for testing or isolated execution)
 */
export async function executeFlowTask(
  task: FlowTask,
  options: {
    systemPrompt: string
    knowledge: KnowledgeNode[]
    enabledFilePaths: string[]
    previousOutput?: Record<string, unknown>
    model?: string
    temperature?: number
  }
): Promise<{ success: boolean; output?: unknown; text: string; error?: string }> {
  const {
    systemPrompt,
    knowledge,
    enabledFilePaths,
    previousOutput = {},
    model = 'zai:glm-4.5-air',
    temperature = 0.7,
  } = options
  
  const knowledgeXml = buildKnowledgeXml(knowledge, enabledFilePaths)
  
  try {
    const { result } = await runPrompt(
      async ({ defSystem, $ }) => {
        // Add system prompt
        defSystem('instructions', systemPrompt)
        
        // Add knowledge XML
        if (knowledgeXml) {
          defSystem('knowledge', knowledgeXml)
        }
        
        // Add previous flow output as context
        if (Object.keys(previousOutput).length > 0) {
          defSystem('flow-context', `
## Previous Flow Output
${JSON.stringify(previousOutput, null, 2)}
`)
        }
        
        // Add task-specific instructions
        defSystem('task-instructions', `
## Current Task
**Name:** ${task.name}
**Description:** ${task.description || 'No description provided'}
**Type:** ${task.type || 'executeTask'}

## Task Instructions
${task.instructions}

${task.type === 'updateFlowOutput' && task.outputSchema ? `
## Expected Output Schema
${JSON.stringify(task.outputSchema, null, 2)}

Store your output in the field: ${task.targetFieldName}
` : ''}
`)
        
        // Execute task
        void $`Execute the task according to the instructions.${task.type === 'updateFlowOutput' ? ' Provide structured output matching the schema.' : ''}`
      },
      {
        model: (task.model || model) as string,
        options: {
          temperature: task.temperature || temperature,
        }
      }
    )
    
    const text = await result.text
    
    return {
      success: true,
      text,
    }
  } catch (error) {
    console.error('Task execution error:', error)
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
