/**
 * Types matching extracted_data_structure.json format
 * This defines the state structure for workspace data loaded from JSON
 */

import type { PromptConfig } from "lmthing";

export type LmthingModelId = Extract<PromptConfig["model"], string>;

// ============== Message Types ==============
export type MessageRole = "user" | "assistant" | "system";

export interface SlashActionParameter {
  [key: string]: string;
}

export interface MessageSlashAction {
  action: string;
  agentId: string;
  flowId: string;
  parameters: SlashActionParameter;
}

export interface StructuredOutput {
  type: string;
  version: string;
  metadata: {
    generatedAt: string;
    generatedBy: string;
    agentId: string;
  };
  [key: string]: unknown; // Allow additional properties like carePlan, hook, component, etc.
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  slashAction?: MessageSlashAction;
  structuredOutput?: StructuredOutput;
}

// ============== Conversation Types ==============
export interface Conversation {
  id: string;
  agentId: string;
  agentName: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// ============== Agent Types ==============
export interface AgentFrontmatter {
  name?: string;
  description?: string;
  tools?: string[];
  selectedFields?: string[];
  [key: string]: unknown;
}

export interface AgentConfig {
  runtimeFields: (string | { id: string; label: string; field: string })[];
  [key: string]: unknown;
}

export interface AgentSlashAction {
  name: string;
  description: string;
  flowId: string;
  actionId: string;
}

export interface FormValues {
  [key: string]: FormFieldValue;
}

export type FormFieldValue = string | string[] | boolean | number | undefined;

export interface Agent {
  id: string;
  frontmatter: AgentFrontmatter;
  mainInstruction: string;
  slashActions: AgentSlashAction[];
  config: AgentConfig;
  formValues: FormValues;
  conversations: Conversation[];
}

// ============== Flow Task Types ==============
export interface TaskOutputSchema {
  type: string;
  properties: Record<string, unknown>;
  required?: string[];
}

export interface TaskFrontmatter {
  description?: string;
  type?: string;
  model?: LmthingModelId;
  temperature?: number;
  isPushable?: string;
  enabledTools?: string[];
  [key: string]: unknown;
}

export interface FlowTask {
  order: number;
  name: string;
  frontmatter: TaskFrontmatter;
  instructions: string;
  outputSchema?: TaskOutputSchema;
  targetFieldName?: string;
}

// ============== Flow Types ==============
export interface FlowFrontmatter {
  id: string;
  name: string;
  status: string;
  scope: string;
  agentId: string;
  tags: string[];
  taskCount: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  [key: string]: unknown;
}

export interface Flow {
  id: string;
  frontmatter: FlowFrontmatter;
  description: string;
  tasks: FlowTask[];
}

// ============== Knowledge Types ==============
export interface FileFrontmatter {
  title?: string;
  order?: string;
  [key: string]: unknown;
}

export interface KnowledgeFile {
  path: string;
  type: "file";
  frontmatter: FileFrontmatter;
  content: string;
}

export interface KnowledgeConfig {
  label?: string;
  description?: string;
  icon?: string;
  color?: string;
  renderAs?: string;
  fieldType?: string;
  required?: boolean;
  default?: string;
  variableName?: string;
  [key: string]: unknown;
}

export interface KnowledgeNode {
  path: string;
  type: "directory" | "file";
  config?: KnowledgeConfig;
  children?: KnowledgeNode[];
  frontmatter?: FileFrontmatter;
  content?: string;
}

// ============== Package Types ==============
export interface PackageJson {
  name: string;
  version: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface EncryptedEnvFile {
  schema: "lmthing-env-v1";
  algorithm: "AES-GCM";
  kdf: "PBKDF2";
  digest: "SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export type WorkspaceEnv = Record<string, EncryptedEnvFile>;

// ============== Workspace Types ==============
export interface WorkspaceData {
  id: string;
  agents: Record<string, Agent>;
  flows: Record<string, Flow>;
  knowledge: KnowledgeNode[];
  packageJson: PackageJson | null;
  env?: WorkspaceEnv;
}

export interface WorkspaceState {
  workspaces: Record<string, WorkspaceData>;
  currentWorkspace: string | null;
}

// ============== Root State Type ==============
export interface ExtractedDataStructure {
  workspaces: Record<string, WorkspaceData>;
}

// ============== Helper Types for Components ==============
export interface AgentListItem {
  id: string;
  name: string;
  description: string;
}

export interface FlowListItem {
  id: string;
  name: string;
  description: string;
  taskCount: number;
  status: string;
  tags: string[];
}

export interface KnowledgeItem {
  path: string;
  label?: string;
  description?: string;
  icon?: string;
  color?: string;
  type: "section" | "field" | "file";
  variableName?: string;
  fieldType?: string;
  required?: boolean;
  default?: string;
  children?: KnowledgeItem[];
}
