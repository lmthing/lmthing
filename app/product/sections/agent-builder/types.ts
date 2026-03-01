/**
 * Agent Builder Section Types
 *
 * Types for the agent builder interface where users configure
 * specialized agents by selecting domains from the Prompt Library,
 * filling out auto-generated forms based on the directory structure,
 * enabling tools from the tool library, setting fields to be
 * configured at runtime, and attaching flows with slash actions.
 *
 * DOMAINS ARE DERIVED FROM PROMPT LIBRARY DIRECTORY STRUCTURE:
 * - Top-level directories = domains
 * - Nested directories = sections or fields
 * - Files within directories = selectable options
 */

import type { Conversation as RuntimeConversation } from '../agent-runtime/types';

/**
 * A form field type within a domain's schema
 */
export type SchemaFieldType = 'text' | 'textarea' | 'select' | 'multiselect' | 'toggle';

/**
 * The source that enabled a tool - always manual after removing auto-enable
 */
export type ToolSource = 'manual';

// ============================================================================
// Domain Schema Types (derived from Prompt Library directory structure)
// ============================================================================

/**
 * A field option representing a file in the Prompt Library
 */
export interface FieldOption {
  /** Unique identifier for this option */
  id: string;
  /** Display label (derived from filename without extension) */
  label: string;
  /** Optional description from frontmatter */
  description?: string;
  /** The file path in Prompt Library */
  filePath: string;
  /** Content value (markdown content from the file) */
  value: string;
  /** Display order */
  order?: number;
  /** Whether this option is disabled */
  disabled?: boolean;
}

/**
 * A schema field representing a directory in the Prompt Library
 */
export interface SchemaField {
  /** Type discriminator for fields */
  type: 'field';
  /** Type of form control */
  fieldType: SchemaFieldType;
  /** Unique identifier for the field (derived from directory path) */
  id: string;
  /** Human-readable label */
  label: string;
  /** Description of what the field controls */
  description?: string;
  /** Placeholder text (for text inputs) */
  placeholder?: string;
  /** Whether the field is required */
  required: boolean;
  /** Default value */
  default: string | string[] | boolean;
  /** Available options (files within the directory) */
  options: FieldOption[];
  /** Hint text displayed below the field */
  hint?: string;
  /** Variable name used in template generation */
  variableName: string;
  /** Whether this field can be set to runtime configuration mode */
  runtimeOptional?: boolean;
  /** Source directory path in Prompt Library */
  directoryPath: string;
}

/**
 * A section representing a nested directory in the Prompt Library
 */
export interface SchemaSection {
  /** Type discriminator for sections */
  type: 'section';
  /** Unique identifier (derived from directory path) */
  id: string;
  /** Section title */
  label: string;
  /** Section description */
  description?: string;
  /** Icon for UI display */
  icon?: string;
  /** Nested fields and subsections */
  children: SchemaNode[];
  /** Source directory path in Prompt Library */
  directoryPath: string;
}

/**
 * Union type for schema nodes (fields or sections)
 */
export type SchemaNode = SchemaField | SchemaSection;

/**
 * Schema defining the form structure for a domain
 * Derived from the nested directory structure in Prompt Library
 */
export interface DomainSchema {
  /** Root node (section or field) */
  root: SchemaNode;
}

/**
 * The configuration status of a tool
 */
export type ToolConfigStatus = 'installed' | 'needs-config' | 'ready';

/**
 * Tool categories for filtering and organization
 */
export type ToolCategory = 'Curriculum' | 'Teaching' | 'Assessment' | 'Special Education' | 'Communication' | 'Collaboration' | 'Reporting';

/**
 * A slash action attached to an agent that triggers a flow
 */
export interface AgentSlashAction {
  /** Unique identifier for the slash action */
  id: string;
  /** The action trigger (e.g., "summarize" - user types /summarize) */
  actionId: string;
  /** Human-readable name for the action */
  name: string;
  /** Description of what the action does */
  description: string;
  /** ID of the flow this action triggers */
  flowId: string;
  /** Name of the flow (for display) - optional since it's available on AttachedFlow */
  flowName?: string;
  /** Whether the action is enabled */
  enabled: boolean;
}

/**
 * A flow attached to an agent with its slash action configuration
 */
export interface AttachedFlow {
  /** ID of the flow */
  flowId: string;
  /** Name of the flow */
  flowName: string;
  /** Description of what the flow does */
  flowDescription: string;
  /** Number of tasks in the flow */
  taskCount: number;
  /** Slash action that triggers this flow */
  slashAction: AgentSlashAction;
}

/**
 * An available domain/expertise area that can be selected when building an agent.
 * Domains are derived from top-level directories in the Prompt Library.
 */
export interface Domain {
  /** Unique identifier for the domain (derived from directory path) */
  id: string;
  /** Human-readable name (from config.label or directory name) */
  name: string;
  /** Description of what the domain covers */
  description?: string;
  /** Category grouping (from directory config or derived) */
  category?: string;
  /** Tags for searchability (from directory config) */
  tags?: string[];
  /** Icon identifier for UI display (from directory config) */
  icon?: string;
  /** Color for visual distinction (from directory config) */
  color?: string;
  /** Schema defining form structure for this domain (derived from nested directories) */
  schema: DomainSchema;
  /** Source directory path in Prompt Library */
  directoryPath: string;
}

/**
 * Field values collected from the form - keyed by field ID
 */
export type FormFieldValue = string | string[] | boolean;

/**
 * Map of field IDs to their values
 */
export interface FormValues {
  [fieldId: string]: FormFieldValue;
}

/**
 * A tool available in the tool library
 */
export interface Tool {
  /** Unique identifier for the tool */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** Category for grouping */
  category: ToolCategory;
  /** NPM package name */
  package: string;
  /** Package version */
  version: string;
  /** Whether the tool is installed in the workspace */
  installed: boolean;
  /** Whether the tool requires configuration */
  configRequired: boolean;
  /** Current configuration values */
  config: Record<string, unknown>;
}

/**
 * A tool that has been enabled for an agent
 */
export interface EnabledTool {
  /** ID of the enabled tool */
  toolId: string;
  /** How the tool was enabled - always manual now */
  source: ToolSource;
  /** Tool configuration if customized */
  config?: Record<string, unknown>;
}

/**
 * Mapping showing which tools are enabled and their source
 */
export interface EnabledToolMapping {
  /** The tool reference */
  tool: Tool;
  /** How the tool was enabled - always manual */
  source: ToolSource;
  /** Current configuration status */
  status: ToolConfigStatus;
}

/**
 * A saved agent configuration
 */
export interface AgentConfig {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the agent's purpose */
  description: string;
  /** Main agent instructions in markdown (custom prompt prepended to domain prompts) */
  mainInstruction?: string;
  /** IDs of selected domains */
  selectedDomains: string[];
  /** Form field values for all selected domains */
  formValues: FormValues;
  /** Tools enabled for this agent (auto + manual) */
  enabledTools: EnabledTool[];
  /** Field IDs that will be configured at runtime (empty placeholders in builder) */
  emptyFieldsForRuntime: string[];
  /** Flows attached to this agent with slash actions */
  attachedFlows?: AttachedFlow[];
  /** When the config was created */
  createdAt: string;
  /** When the config was last updated */
  updatedAt: string;
}

/**
 * Live-generated preview of the system prompt
 */
export interface PromptPreview {
  /** ID of the agent config */
  agentId: string;
  /** Names of domains included */
  domains: string[];
  /** The generated prompt text */
  generatedPrompt: string;
  /** Estimated token count */
  tokenCount: number;
  /** When the preview was last generated */
  lastGenerated: string;
}

/**
 * Props for the Agent Builder screen
 */
export interface AgentBuilderProps {
  /** Available domains to select from */
  domains: Domain[];
  /** All available tools in the tool library */
  toolLibrary: Tool[];
  /** Previously saved agent configurations */
  savedAgentConfigs: AgentConfig[];
  /** Currently selected domain IDs */
  selectedDomainIds?: string[];
  /** Current form values */
  formValues?: FormValues;
  /** Currently enabled tools */
  enabledTools?: EnabledTool[];
  /** Fields enabled for runtime configuration (shown as placeholders, not editable) */
  emptyFieldsForRuntime?: string[];
  /** Flows attached to this agent with slash actions */
  attachedFlows?: AttachedFlow[];
  /** Available flows that can be attached to the agent */
  availableFlows?: Array<{ id: string; name: string; description: string; taskCount: number }>;
  /** Currently loaded agent config (for editing) */
  loadedAgentId?: string | null;
  /** Main agent instructions in markdown (custom prompt prepended to domain prompts) */
  mainInstruction?: string;
  /** Live prompt preview */
  promptPreview?: PromptPreview;
  /** Loading state */
  isLoading?: boolean;
  /** Validation errors by field ID */
  validationErrors?: Record<string, string>;
  /** Whether tool library modal is open */
  toolLibraryOpen?: boolean;
  /** Whether flow builder/selector modal is open */
  flowBuilderOpen?: boolean;
  /** Called when saving runtime preview conversation to workspace */
  onSaveRuntimeConversation?: (conversation: RuntimeConversation) => void;
}

/**
 * Callback props for Agent Builder actions
 */
export interface AgentBuilderCallbacks {
  /** Called when one or more domains are selected/deselected */
  onDomainsChange: (domainIds: string[]) => void;
  /** Called when a form field value changes */
  onFieldValueChange: (fieldId: string, value: FormFieldValue) => void;
  /** Called when a field's runtime mode is toggled on (field becomes placeholder) */
  onEnableFieldForRuntime: (fieldId: string) => void;
  /** Called when a field's runtime mode is toggled off (field becomes editable) */
  onDisableFieldForRuntime: (fieldId: string) => void;
  /** Called when the main instruction markdown changes */
  onMainInstructionChange: (instruction: string) => void;
  /** Called to open the tool library modal */
  onOpenToolLibrary: () => void;
  /** Called to close the tool library modal */
  onCloseToolLibrary: () => void;
  /** Called to add a tool from the library */
  onAddTool: (toolId: string, config?: Record<string, unknown>) => void;
  /** Called to remove an enabled tool */
  onRemoveTool: (toolId: string) => void;
  /** Called to update tool configuration */
  onConfigureTool: (toolId: string, config: Record<string, unknown>) => void;
  /** Called to regenerate the prompt preview */
  onGeneratePreview: () => void;
  /** Called to save the current agent configuration */
  onSaveAgent: (name: string, description: string) => void;
  /** Called to load an existing agent for editing */
  onLoadAgent: (agentId: string) => void;
  /** Called to delete a saved agent configuration */
  onDeleteAgent: (agentId: string) => void;
  /** Called to duplicate an agent */
  onDuplicateAgent: (agentId: string) => void;
  /** Called to create a new agent (clear form) */
  onNewAgent: () => void;
  /** Called to open the flow builder modal */
  onOpenFlowBuilder: () => void;
  /** Called to close the flow builder modal */
  onCloseFlowBuilder: () => void;
  /** Called to attach a flow with a slash action */
  onAttachFlow: (flowId: string, actionId: string, name: string, description: string) => void;
  /** Called to detach a flow from the agent */
  onDetachFlow: (slashActionId: string) => void;
  /** Called to toggle a slash action enabled/disabled */
  onToggleSlashAction: (slashActionId: string, enabled: boolean) => void;
  /** Called to edit an existing slash action - receives the slash action ID */
  onEditSlashAction: (slashActionId: string) => void;
}

/**
 * Combined props interface including callbacks
 */
export type AgentBuilderScreenProps = AgentBuilderProps & AgentBuilderCallbacks;
