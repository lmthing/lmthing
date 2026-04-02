// ── System Prompt ──
// Reimplemented using the modular SystemPromptBuilder from @lmthing/repl

import type { SystemPromptConfig } from '@lmthing/repl/context/prompt';
import { buildSystemPromptFromConfig } from '@lmthing/repl/context/prompt';

/**
 * Build the system prompt from components.
 *
 * @deprecated Use buildSystemPromptFromConfig() from @lmthing/repl/context/prompt instead.
 * This function is maintained for backward compatibility.
 */
export function buildSystemPrompt(
  fnSigs: string,
  formSigs: string,
  viewSigs: string,
  classSigs: string,
  scope: string,
  instruct?: string,
  knowledgeTree?: string,
  agentTree?: string,
  knowledgeNamespacePrompt?: string,
  pinnedBlock?: string,
  memoBlock?: string,
  focusSections?: Set<string> | null,
): string {
  const config: SystemPromptConfig = {
    functionSignatures: fnSigs,
    formSignatures: formSigs,
    viewSignatures: viewSigs,
    classSignatures: classSigs,
    scope: scope,
    instruct: instruct,
    knowledgeTree: knowledgeTree,
    agentTree: agentTree,
    knowledgeNamespacePrompt: knowledgeNamespacePrompt,
    pinnedBlock: pinnedBlock,
    memoBlock: memoBlock,
    focusSections: focusSections,
  };

  return buildSystemPromptFromConfig(config);
}

// Re-export the new types and functions for forward compatibility
export type { SystemPromptConfig, SectionName } from '@lmthing/repl/context/prompt';
export { buildSystemPromptFromConfig, SystemPromptBuilder, FocusController } from '@lmthing/repl/context/prompt';
