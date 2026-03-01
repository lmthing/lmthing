/**
 * Flow Builder Section Types
 *
 * Data structures for the Flow Builder feature within Agent Builder,
 * enabling users to create sequential task flows with various task types.
 * Flows can be attached to agents and triggered by slash actions.
 */

/**
 * Type of task that defines what operation it performs
 * - updateFlowOutput: Updates a specific key in the flow output with structured LLM output
 * - executeTask: Performs operations without adding structured LLM output to flow state
 */
export type TaskType = "updateFlowOutput" | "executeTask";

/**
 * Status of a flow or task
 */
export type FlowStatus = "active" | "draft" | "archived";

/**
 * Scope of a flow - whether it's standalone or built for a specific agent
 */
export type FlowScope = "standalone" | "agent-specific";

/**
 * Validation status of a task configuration
 */
export type TaskStatus = "valid" | "invalid" | "pending";

/**
 * Priority level for support-related flows
 */
export type PriorityLevel = "P1" | "P2" | "P3";

/**
 * Urgency level for ticket categorization
 */
export type UrgencyLevel = "low" | "medium" | "high" | "critical";

/**
 * A slash action that triggers a flow when a user types it in conversation
 */
export interface SlashAction {
  /** Unique identifier for the slash action */
  id: string;
  /** The action trigger (e.g., "summarize", "analyze" - user types /summarize) */
  actionId: string;
  /** Human-readable name for the action */
  name: string;
  /** Description of what the action does (shown to users) */
  description: string;
  /** ID of the flow this action triggers */
  flowId: string;
  /** ID of the agent this action belongs to */
  agentId: string;
  /** Whether the action is enabled */
  enabled: boolean;
}

/**
 * A sequential task flow that defines a series of operations to be executed in order
 */
export interface Flow {
  /** Unique identifier for the flow */
  id: string;
  /** Human-readable name for the flow */
  name: string;
  /** Detailed description of what the flow does */
  description: string;
  /** Current status of the flow */
  status: FlowStatus;
  /** Scope of the flow - standalone or built for a specific agent */
  scope: FlowScope;
  /** If agent-specific, the ID of the agent this flow belongs to */
  agentId?: string | null;
  /** Tags for categorizing and filtering flows */
  tags: string[];
  /** Number of tasks in this flow */
  taskCount: number;
  /** ISO timestamp when the flow was created */
  createdAt: string;
  /** ISO timestamp when the flow was last updated */
  updatedAt: string;
  /** ISO timestamp when the flow was last executed (null if never run) */
  lastRunAt: string | null;
}

/**
 * A single step within a flow that performs a specific operation
 */
export interface Task {
  /** Unique identifier for the task */
  id: string;
  /** ID of the flow this task belongs to */
  flowId: string;
  /** The type of operation this task performs */
  type: TaskType;
  /** Position of this task in the flow sequence (1-indexed) */
  order: number;
  /** Human-readable name for the task */
  name: string;
  /** Brief description of what this task does */
  description: string;
  /** Type-specific configuration for the task */
  config: TaskConfig;
  /** Validation status of the task configuration */
  status: TaskStatus;
}

/**
 * Union type for task-specific configurations based on task type
 */
export type TaskConfig = FlowTaskConfig;

/**
 * Configuration for flow task types (updateFlowOutput and executeTask)
 */
export interface FlowTaskConfig {
  /** JSON Schema definition for expected output structure (updateFlowOutput only) */
  outputSchema?: JSONSchema;

  /** The key in the flow output object where the LLM output will be stored (updateFlowOutput only, required) */
  targetFieldName?: string;

  /** If true, the LLM output is pushed to an array at targetFieldName instead of overwriting (updateFlowOutput only) */
  isPushable?: boolean;

  /** Prompt fragments to enable with specific field values */
  promptFragmentFields?: PromptFragmentField[];

  /** Tools to enable for this task (from workspace tool registry) */
  enabledTools?: string[];

  /** Task-specific instructions (supports template variables) */
  taskInstructions?: string;

  /** Model identifier to use for generation (inherits from agent if not specified) */
  model?: string;

  /** Temperature setting for generation (0-1, inherits from agent if not specified) */
  temperature?: number;
}

/**
 * A prompt fragment field configuration
 */
export interface PromptFragmentField {
  /** Fragment identifier */
  fragmentId: string;

  /** Field values that enable this fragment */
  fieldValues: Record<string, string | number | boolean>;
}

/**
 * A JSON Schema definition
 */
export interface JSONSchema {
  /** Schema type (object, array, string, etc.) */
  type: string;
  /** Properties for object type schemas */
  properties?: Record<string, JSONSchema>;
  /** Required properties for object type schemas */
  required?: string[];
  /** Array of allowed values for enum schemas */
  enum?: string[];
  /** Format string for string type schemas (e.g., email, date) */
  format?: string;
  /** Minimum value for numeric schemas */
  minimum?: number;
  /** Maximum value for numeric schemas */
  maximum?: number;
  /** Item type for array schemas */
  items?: JSONSchema;
}

/**
 * Props interface for the Flow Builder section
 */
export interface FlowBuilderProps {
  /** Array of flows to display */
  flows: Flow[];
  /** Tasks for all flows (grouped by flowId for efficient lookup) */
  tasks: Task[];
  /** Currently selected flow (null if in list view) */
  selectedFlowId: string | null;
  /** Whether the task configuration panel is open */
  isConfigPanelOpen: boolean;
  /** Task being edited (null if none) */
  editingTaskId: string | null;
  /** Callback when a flow is selected */
  onSelectFlow?: (flowId: string) => void;
  /** Callback when a new flow is created */
  onCreateFlow?: (flow: Omit<Flow, "id" | "createdAt" | "updatedAt" | "lastRunAt" | "taskCount">) => void;
  /** Callback when a flow is updated */
  onUpdateFlow?: (flowId: string, updates: Partial<Flow>) => void;
  /** Callback when a flow is deleted */
  onDeleteFlow?: (flowId: string) => void;
  /** Callback when a task is added to a flow */
  onAddTask?: (flowId: string, task: Omit<Task, "id">) => void;
  /** Callback when a task is updated */
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  /** Callback when a task is deleted */
  onDeleteTask?: (taskId: string) => void;
  /** Callback when tasks are reordered */
  onReorderTasks?: (flowId: string, taskIds: string[]) => void;
  /** Callback when opening the task configuration panel */
  onOpenConfigPanel?: (taskId: string | null) => void;
  /** Callback when closing the task configuration panel */
  onCloseConfigPanel?: () => void;
  /** Callback when saving task configuration */
  onSaveTaskConfig?: (taskId: string, config: TaskConfig) => void;
}

/**
 * Props for a single task card component
 */
export interface TaskCardProps {
  /** The task to display */
  task: Task;
  /** Whether this card is currently expanded */
  isExpanded: boolean;
  /** Whether this task can be reordered */
  isDraggable: boolean;
  /** Callback when the card is clicked */
  onClick?: () => void;
  /** Callback when the edit button is clicked */
  onEdit?: () => void;
  /** Callback when the delete button is clicked */
  onDelete?: () => void;
  /** Callback when the duplicate button is clicked */
  onDuplicate?: () => void;
}

/**
 * Props for the task configuration panel component
 */
export interface TaskConfigPanelProps {
  /** The task being edited (null for new task) */
  task: Task | null;
  /** Available tools that can be called */
  availableTools: Array<{ id: string; name: string; description: string }>;
  /** Available prompt fragments that can be added */
  availablePromptFragments?: Array<{ id: string; name: string; description: string }>;
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback when the panel is closed */
  onClose: () => void;
  /** Callback when configuration is saved - includes name, description, type, and config */
  onSave: (updates: { name: string; description: string; type: TaskType; config: TaskConfig }) => void;
}

/**
 * Props for the flow list view component
 */
export interface FlowListProps {
  /** Flows to display */
  flows: Flow[];
  /** Currently selected flow ID */
  selectedFlowId: string | null;
  /** Callback when a flow is selected */
  onSelectFlow: (flowId: string) => void;
  /** Callback when creating a new flow */
  onCreateFlow: () => void;
  /** Callback when deleting a flow */
  onDeleteFlow: (flowId: string) => void;
  /** Active filter tag (null for no filter) */
  activeTagFilter: string | null;
  /** Callback when filter tag changes */
  onTagFilterChange: (tag: string | null) => void;
}
