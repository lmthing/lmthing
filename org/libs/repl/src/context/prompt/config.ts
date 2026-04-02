/**
 * SystemPromptConfig — named object for system prompt assembly.
 *
 * Replaces 12 positional parameters with a single configuration object,
 * making prompt assembly more maintainable and less error-prone.
 */
export interface SystemPromptConfig {
  /** Function signatures from catalog and user code */
  functionSignatures?: string;
  /** Form component signatures */
  formSignatures?: string;
  /** View component signatures */
  viewSignatures?: string;
  /** Class signatures with methods */
  classSignatures?: string;
  /** Current scope table ({{SCOPE}} block) */
  scope: string;
  /** Additional instructions to append to system prompt */
  instruct?: string;
  /** Knowledge tree formatted for prompt */
  knowledgeTree?: string;
  /** Agent tree formatted for prompt */
  agentTree?: string;
  /** Knowledge namespace formatted for prompt */
  knowledgeNamespacePrompt?: string;
  /** Pinned memory block ({{PINNED}}) */
  pinnedBlock?: string;
  /** Memo memory block ({{MEMO}}) */
  memoBlock?: string;
  /** Focus sections to keep expanded (null = all expanded) */
  focusSections?: Set<string> | null;
}

/**
 * Section names for targeted rebuilding.
 */
export type SectionName =
  | 'role'
  | 'globals'
  | 'scope'
  | 'components'
  | 'functions'
  | 'agents'
  | 'knowledge'
  | 'rules'
  | 'instruct';
