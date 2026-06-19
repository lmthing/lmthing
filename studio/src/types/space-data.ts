/**
 * Space Data Types — NEW SPEC
 *
 * These types model the on-disk layout read/written by studio. The pod's framework
 * loader (sdk/org/packages/core/src/spaces/*) reads exactly this layout.
 *
 * Layout summary:
 *   agents/<slug>/instruct.md           — YAML frontmatter + system-prompt body
 *   tasklists/<name>/NN-<id>.md         — zero-padded task files (replaces flows/)
 *   knowledge/<domain>/<field>/index.md — field manifest (type/variable/default)
 *   knowledge/<domain>/<field>/<slug>.md — option files (plain markdown)
 *   functions/<name>.ts                 — single-export TypeScript functions
 *   components/view/<Name>.tsx          — view component (default export)
 *   components/form/<Name>/web.tsx      — form component web variant
 *   components/form/<Name>/ink.tsx      — form component ink (terminal) variant
 */

// Re-export hierarchy types from lib/state
export type { StudioConfig, SpaceConfig, AppData, FileTree, StudioData } from "@lmthing/state";

/**
 * Model identifier string accepted by the lmthing runtime.
 * Format: "<provider>/<modelId>", e.g. "azure/gpt-4o" or "anthropic/claude-3-5-sonnet-20241022".
 */
export type LmthingModelId = string;

// ============== Message Types ==============
export type MessageRole = "user" | "assistant" | "system";

export interface SlashActionParameter {
  [key: string]: string;
}

export interface MessageSlashAction {
  action: string;
  agentId: string;
  tasklistName: string;
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
  [key: string]: unknown;
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

/**
 * One action declared in an agent's instruct.md frontmatter.
 * The `tasklist` field is the name of a tasklist directory in tasklists/.
 */
export interface AgentAction {
  id: string;
  label: string;
  description: string;
  tasklist: string;
}

/**
 * The YAML frontmatter of agents/<slug>/instruct.md.
 * Matches the shape scaffoldSpace.ts writes and the framework loader reads.
 */
export interface AgentFrontmatter {
  title: string;
  /** refs into knowledge/ — "<domain>/<field>" */
  knowledge: string[];
  /** function names in functions/ */
  functions: string[];
  /** component names in components/view or components/form */
  components: string[];
  actions: AgentAction[];
  /** optional: id of the default action */
  defaultAction?: string;
  /** optional: space-ref/agent-slug dependencies */
  dependencies: string[];
  /** optional: per-component runtime field selections — component name → list of field refs */
  runtimeFields?: Record<string, string[]>;
  /** optional: per-component saved form values — component name → key/value map */
  formValues?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * An agent as extracted from the VFS.
 */
export interface Agent {
  id: string;
  frontmatter: AgentFrontmatter;
  /** The system-prompt body (everything after the frontmatter --- block) */
  body: string;
  conversations: Conversation[];
}

// ============== Tasklist / Task Types ==============

/**
 * Output schema for a tasklist task.
 * Keys are field names, values are type strings ("string", "number", "boolean", "object", "array").
 */
export type TaskOutput = Record<string, string>;

/**
 * One task file inside tasklists/<name>/NN-<id>.md.
 */
export interface Task {
  /** The numeric order (1-based, parsed from the NN- prefix) */
  order: number;
  /** The task id (the part after NN-) */
  id: string;
  /** The instruction body (everything after the frontmatter) */
  instruction: string;
  output: TaskOutput;
  dependsOn?: string[];
  optional?: boolean;
  /** Exactly one task per tasklist has goal: true */
  goal?: boolean;
  condition?: string;
}

/**
 * A complete tasklist with all its task files.
 */
export interface Tasklist {
  /** The tasklist directory name under tasklists/ */
  name: string;
  tasks: Task[];
}

// ============== Knowledge Types ==============

/**
 * The frontmatter of knowledge/<domain>/<field>/index.md.
 */
export interface KnowledgeFieldIndex {
  type: string; // "string" | "number" | "boolean" | "object" | "array"
  variable: string;
  default?: string;
  label?: string;
  fieldType?: string;
  required?: boolean;
  renderAs?: string;
}

/**
 * A knowledge field with its index manifest and option files.
 */
export interface KnowledgeField {
  /** slug of this field (directory name) */
  slug: string;
  index: KnowledgeFieldIndex;
  /** The description text (body of index.md) */
  description: string;
  /** Map of option slug → full markdown content */
  options: Record<string, string>;
}

/**
 * A knowledge domain (top-level directory under knowledge/).
 */
export interface KnowledgeDomain {
  /** slug of this domain (directory name) */
  slug: string;
  fields: Record<string, KnowledgeField>;
  /** optional: display label for the domain */
  label?: string;
  /** optional: emoji or icon identifier */
  icon?: string;
  /** optional: hex color for the domain */
  color?: string;
  /** optional: description text (body of knowledge/<domain>/index.md) */
  description?: string;
}

// ============== Function / Component Types ==============

export interface FunctionFile {
  name: string;
  /** Raw TypeScript source */
  source: string;
}

export interface ViewComponent {
  name: string;
  /** Raw TSX source */
  source: string;
}

export interface FormComponent {
  name: string;
  web: string;
  ink: string;
}

export interface SpaceComponents {
  view: Record<string, ViewComponent>;
  form: Record<string, FormComponent>;
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

export type SpaceEnv = Record<string, EncryptedEnvFile>;

// ============== Space Types ==============

/**
 * A fully-extracted space — all five pillars: agents, tasklists, knowledge,
 * functions, and components.
 */
export interface SpaceData {
  id: string;
  agents: Record<string, Agent>;
  tasklists: Record<string, Tasklist>;
  knowledge: Record<string, KnowledgeDomain>;
  functions: Record<string, FunctionFile>;
  components: SpaceComponents;
  packageJson: PackageJson | null;
  env?: SpaceEnv;
}

export interface SpaceState {
  spaces: Record<string, SpaceData>;
  currentSpace: string | null;
}

// ============== Root State Type ==============
export interface ExtractedDataStructure {
  spaces: Record<string, SpaceData>;
}

// ============== Helper Types for Components ==============
export interface AgentListItem {
  id: string;
  title: string;
  actionCount: number;
}

export interface TasklistListItem {
  name: string;
  taskCount: number;
}

export interface KnowledgeFieldItem {
  domain: string;
  field: string;
  variable: string;
  type: string;
  default?: string;
  optionCount: number;
}

// ============== Backward Compatibility Aliases ==============
/** @deprecated Use SpaceData */
export type WorkspaceData = SpaceData;
/** @deprecated Use SpaceState */
export type WorkspaceState = SpaceState;
/** @deprecated Use SpaceEnv */
export type WorkspaceEnv = SpaceEnv;
