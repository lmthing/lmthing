/**
 * @deprecated — import from '@/types/space-data' instead.
 *
 * This file exists only for backward compatibility with modules that have not
 * yet been migrated to the new space spec.  It re-exports everything from
 * space-data so the build does not break while those files are still in-flight.
 */

export type {
  LmthingModelId,
  MessageRole,
  SlashActionParameter,
  MessageSlashAction,
  StructuredOutput,
  Message,
  Conversation,
  AgentFrontmatter,
  AgentAction,
  Agent,
  Task,
  TaskOutput,
  Tasklist,
  KnowledgeFieldIndex,
  KnowledgeField,
  KnowledgeDomain,
  FunctionFile,
  ViewComponent,
  FormComponent,
  SpaceComponents,
  PackageJson,
  EncryptedEnvFile,
  SpaceEnv,
  SpaceData,
  SpaceState,
  ExtractedDataStructure,
  AgentListItem,
  TasklistListItem,
  KnowledgeFieldItem,
  // backward-compat aliases
  WorkspaceData,
  WorkspaceState,
  WorkspaceEnv,
} from './space-data'

// ---------------------------------------------------------------------------
// Legacy types that existed in the OLD workspace-data.ts but are NOT part of
// the new spec.  Kept here as minimal stubs so that files still importing them
// (buildKnowledgeXml.ts, workspaceLoader.ts, StudioShell.tsx) compile without
// changes until those modules are updated in the follow-up UI task.
// ---------------------------------------------------------------------------

/** @deprecated Use KnowledgeField/KnowledgeDomain from space-data instead. */
export interface KnowledgeNode {
  path: string;
  type: "directory" | "file";
  config?: Record<string, unknown>;
  children?: KnowledgeNode[];
  frontmatter?: Record<string, unknown>;
  content?: string;
}

/** @deprecated */
export interface AgentConfig {
  runtimeFields: (string | { id: string; label: string; field: string })[];
  [key: string]: unknown;
}

/** @deprecated */
export interface AgentSlashAction {
  name: string;
  description: string;
  flowId: string;
  actionId: string;
}

/** @deprecated */
export interface FormValues {
  [key: string]: string | string[] | boolean | number | undefined;
}

/** @deprecated */
export type FormFieldValue = string | string[] | boolean | number | undefined;

/** @deprecated */
export interface TaskOutputSchema {
  type: string;
  properties: Record<string, unknown>;
  required?: string[];
}

/** @deprecated */
export interface TaskFrontmatter {
  description?: string;
  type?: string;
  model?: string;
  temperature?: number;
  isPushable?: string;
  enabledTools?: string[];
  [key: string]: unknown;
}

/** @deprecated */
export interface FlowTask {
  order: number;
  name: string;
  frontmatter: TaskFrontmatter;
  instructions: string;
  outputSchema?: TaskOutputSchema;
  targetFieldName?: string;
}

/** @deprecated */
export interface FlowFrontmatter {
  id: string;
  name: string;
  status: string;
  scope: string;
  agentId: string;
  tags: string[];
  taskCount?: string;
  stepCount?: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  [key: string]: unknown;
}

/** @deprecated */
export interface Flow {
  id: string;
  frontmatter: FlowFrontmatter;
  description: string;
  tasks: FlowTask[];
}

/** @deprecated */
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

/** @deprecated */
export interface FlowListItem {
  id: string;
  name: string;
  description: string;
  taskCount: number;
  status: string;
  tags: string[];
}

/** @deprecated Use KnowledgeFieldItem from space-data */
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

// WorkspaceData in the OLD spec had agents/flows/knowledge/packageJson/env.
// The new SpaceData has agents/tasklists/knowledge/functions/components/packageJson/env.
// Code that still uses the old shape (workspaceLoader.ts, StudioShell.tsx) will
// get type errors on the fields it actually touches — that is intentional: it
// signals what needs updating in the follow-up UI task.
