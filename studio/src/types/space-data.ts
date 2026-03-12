/**
 * Phase 4: Domain Type Renames
 *
 * New canonical types for the UI layer. Maps old entity names to new ones:
 *   WorkspaceData → SpaceData
 *   Agent → Assistant
 *   Flow → Workflow
 *   FlowTask → WorkflowStep
 *   KnowledgeDomain → KnowledgeField
 *
 * FS paths stay unchanged (agents/, flows/) — only UI types are renamed.
 */

import type { PromptConfig } from '../../../org/core/dist'

// Re-export hierarchy types from lib/state
export type { StudioConfig, SpaceConfig, AppData, FileTree, StudioData } from '../../../org/state/src'

export type LmthingModelId = Extract<PromptConfig['model'], string>

// ============== Message Types ==============
export type MessageRole = 'user' | 'assistant' | 'system'

export interface SlashActionParameter {
  [key: string]: string
}

export interface MessageSlashAction {
  action: string
  assistantId: string
  workflowId: string
  parameters: SlashActionParameter
}

export interface StructuredOutput {
  type: string
  version: string
  metadata: {
    generatedAt: string
    generatedBy: string
    assistantId: string
  }
  [key: string]: unknown
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: string
  slashAction?: MessageSlashAction
  structuredOutput?: StructuredOutput
}

// ============== Conversation Types ==============
export interface Conversation {
  id: string
  assistantId: string
  assistantName: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

// ============== Assistant Types (was Agent) ==============
export interface AssistantFrontmatter {
  name?: string
  description?: string
  tools?: string[]
  selectedFields?: string[]
  [key: string]: unknown
}

export interface AssistantConfig {
  emptyFieldsForRuntime: (string | { id: string; label: string; field: string })[]
  [key: string]: unknown
}

export interface AssistantSlashAction {
  name: string
  description: string
  workflowId: string
  actionId: string
}

export interface FormValues {
  [key: string]: FormFieldValue
}

export type FormFieldValue = string | string[] | boolean | number | undefined

export interface Assistant {
  id: string
  frontmatter: AssistantFrontmatter
  mainInstruction: string
  slashActions: AssistantSlashAction[]
  config: AssistantConfig
  formValues: FormValues
  conversations: Conversation[]
}

// ============== Workflow Step Types (was FlowTask) ==============
export interface StepOutputSchema {
  type: string
  properties: Record<string, unknown>
  required?: string[]
}

export interface StepFrontmatter {
  description?: string
  type?: string
  model?: LmthingModelId
  temperature?: number
  isPushable?: string
  enabledTools?: string[]
  [key: string]: unknown
}

export interface WorkflowStep {
  order: number
  name: string
  frontmatter: StepFrontmatter
  instructions: string
  outputSchema?: StepOutputSchema
  targetFieldName?: string
}

// ============== Workflow Types (was Flow) ==============
export interface WorkflowFrontmatter {
  id: string
  name: string
  status: string
  scope: string
  assistantId: string
  tags: string[]
  stepCount: string
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  [key: string]: unknown
}

export interface Workflow {
  id: string
  frontmatter: WorkflowFrontmatter
  description: string
  steps: WorkflowStep[]
}

// ============== Knowledge Types ==============
export interface FileFrontmatter {
  title?: string
  order?: string
  [key: string]: unknown
}

export interface KnowledgeFile {
  path: string
  type: 'file'
  frontmatter: FileFrontmatter
  content: string
}

export interface KnowledgeFieldConfig {
  label?: string
  description?: string
  icon?: string
  color?: string
  renderAs?: string
  fieldType?: string
  required?: boolean
  default?: string
  variableName?: string
  [key: string]: unknown
}

export interface KnowledgeNode {
  path: string
  type: 'directory' | 'file'
  config?: KnowledgeFieldConfig
  children?: KnowledgeNode[]
  frontmatter?: FileFrontmatter
  content?: string
}

// ============== Package Types ==============
export interface PackageJson {
  name: string
  version: string
  description?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

export interface EncryptedEnvFile {
  schema: 'lmthing-env-v1'
  algorithm: 'AES-GCM'
  kdf: 'PBKDF2'
  digest: 'SHA-256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
  createdAt: string
  updatedAt: string
  expiresAt?: string
}

export type SpaceEnv = Record<string, EncryptedEnvFile>

// ============== Space Types (was Workspace) ==============
export interface SpaceData {
  id: string
  assistants: Record<string, Assistant>
  workflows: Record<string, Workflow>
  knowledge: KnowledgeNode[]
  packageJson: PackageJson | null
  env?: SpaceEnv
}

export interface SpaceState {
  spaces: Record<string, SpaceData>
  currentSpace: string | null
}

// ============== Root State Type ==============
export interface ExtractedDataStructure {
  spaces: Record<string, SpaceData>
}

// ============== Helper Types for Components ==============
export interface AssistantListItem {
  id: string
  name: string
  description: string
}

export interface WorkflowListItem {
  id: string
  name: string
  description: string
  stepCount: number
  status: string
  tags: string[]
}

export interface KnowledgeFieldItem {
  path: string
  label?: string
  description?: string
  icon?: string
  color?: string
  type: 'section' | 'field' | 'file'
  variableName?: string
  fieldType?: string
  required?: boolean
  default?: string
  children?: KnowledgeFieldItem[]
}

// ============== Backward Compatibility Aliases ==============
// These aliases allow gradual migration from old type names

/** @deprecated Use Assistant */
export type Agent = Assistant
/** @deprecated Use AssistantFrontmatter */
export type AgentFrontmatter = AssistantFrontmatter
/** @deprecated Use AssistantConfig */
export type AgentConfig = AssistantConfig
/** @deprecated Use AssistantSlashAction */
export type AgentSlashAction = AssistantSlashAction
/** @deprecated Use AssistantListItem */
export type AgentListItem = AssistantListItem
/** @deprecated Use Workflow */
export type Flow = Workflow
/** @deprecated Use WorkflowFrontmatter */
export type FlowFrontmatter = WorkflowFrontmatter
/** @deprecated Use WorkflowStep */
export type FlowTask = WorkflowStep
/** @deprecated Use StepFrontmatter */
export type TaskFrontmatter = StepFrontmatter
/** @deprecated Use StepOutputSchema */
export type TaskOutputSchema = StepOutputSchema
/** @deprecated Use WorkflowListItem */
export type FlowListItem = WorkflowListItem
/** @deprecated Use SpaceData */
export type WorkspaceData = SpaceData
/** @deprecated Use SpaceState */
export type WorkspaceState = SpaceState
/** @deprecated Use SpaceEnv */
export type WorkspaceEnv = SpaceEnv
/** @deprecated Use KnowledgeFieldConfig */
export type KnowledgeConfig = KnowledgeFieldConfig
/** @deprecated Use KnowledgeFieldItem */
export type KnowledgeItem = KnowledgeFieldItem
