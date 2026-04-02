/**
 * SystemPromptBuilder — composable, section-cached prompt assembly.
 *
 * Replaces the monolithic 575-line buildSystemPrompt() with a modular,
 * section-based approach that enables targeted updates without rebuilding
 * the entire prompt.
 */

import { FocusController } from './focus';
import { SystemPromptConfig } from './config';
import { buildRoleSection } from './sections/role';
import { buildGlobalsSection } from './sections/globals';
import { buildScopeSection } from './sections/scope';
import { buildComponentsSection } from './sections/components';
import { buildFunctionsSection } from './sections/functions';
import { buildAgentsSection } from './sections/agents';
import { buildKnowledgeSection } from './sections/knowledge';
import { buildInstructSection } from './sections/instruct';

export class SystemPromptBuilder {
  private config: SystemPromptConfig;
  private focus: FocusController;
  private cachedPrompt: string | null = null;

  constructor(config: SystemPromptConfig) {
    this.config = config;
    this.focus = new FocusController(config.focusSections ?? null);
  }

  /**
   * Build the complete system prompt.
   */
  build(): string {
    const sections = [
      buildRoleSection(),
      '<documentation>',
      buildGlobalsSection(this.config, this.focus),
      buildScopeSection(this.config.scope, this.config.pinnedBlock, this.config.memoBlock, this.focus),
      buildComponentsSection(this.config.formSignatures, this.config.viewSignatures, this.focus),
      buildFunctionsSection(this.config.functionSignatures, this.config.classSignatures, this.focus),
      buildAgentsSection(this.config.agentTree, this.config.knowledgeNamespacePrompt, this.focus),
      buildKnowledgeSection(this.config.knowledgeTree, this.focus),
      '</documentation>',
      buildInstructSection(this.config.instruct),
    ];

    this.cachedPrompt = sections.filter(Boolean).join('\n\n');
    return this.cachedPrompt;
  }

  /**
   * Update scope-related sections and return updated prompt.
   */
  updateScope(scope: string, pinned?: string, memo?: string): string {
    this.config.scope = scope;
    this.config.pinnedBlock = pinned;
    this.config.memoBlock = memo;
    this.cachedPrompt = null;
    return this.build();
  }

  /**
   * Update agents section and return updated prompt.
   */
  updateAgents(agentTree: string): string {
    this.config.agentTree = agentTree;
    this.cachedPrompt = null;
    return this.build();
  }

  /**
   * Update knowledge section and return updated prompt.
   */
  updateKnowledge(knowledgeTree: string): string {
    this.config.knowledgeTree = knowledgeTree;
    this.cachedPrompt = null;
    return this.build();
  }

  /**
   * Set focus sections and return updated prompt.
   */
  setFocus(focusSections: Set<string> | null): string {
    this.config.focusSections = focusSections;
    this.focus = new FocusController(focusSections as Set<import('./focus').SectionName> | null);
    this.cachedPrompt = null;
    return this.build();
  }
}

/**
 * Build a system prompt from the given configuration.
 *
 * This is the main entry point that replaces the old buildSystemPrompt function.
 */
export function buildSystemPromptFromConfig(config: SystemPromptConfig): string {
  const builder = new SystemPromptBuilder(config);
  return builder.build();
}
