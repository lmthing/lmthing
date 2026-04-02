/**
 * System prompt builder — composable, section-cached prompt assembly.
 *
 * Replaces the monolithic 575-line buildSystemPrompt() with a modular,
 * section-based approach that enables targeted updates without rebuilding
 * the entire prompt.
 *
 * @example
 * ```ts
 * import { SystemPromptBuilder, buildSystemPromptFromConfig, FocusController } from '@lmthing/repl/context/prompt';
 *
 * const config: SystemPromptConfig = {
 *   functionSignatures: 'function foo() {}',
 *   scope: 'x = 1',
 *   // ... other config
 * };
 *
 * const builder = new SystemPromptBuilder(config);
 * const prompt = builder.build();
 * ```
 */

// Main builder and configuration
export { SystemPromptBuilder, buildSystemPromptFromConfig } from './builder';
export type { SystemPromptConfig, SectionName } from './config';

// Focus controller
export { FocusController } from './focus';
export type { SectionName as FocusSectionName } from './focus';

// Section builders (for advanced use cases)
export * from './sections';
