/**
 * LLM Integration Test for defKnowledgeAgent
 *
 * Tests the knowledge agent plugin with real LLMs against:
 * - space-chat (simple agent with knowledge fields, no flows)
 * - education (agent with slash actions and multi-step flows)
 *
 * Running:
 * LM_TEST_MODEL=openai:gpt-4o-mini npm test -- --run tests/integration/defKnowledgeAgent
 */

import { describe, it, expect } from 'vitest';
import { runPrompt } from '../../src/runPrompt';
import { knowledgeAgentPlugin } from '../../src/plugins/knowledgeAgent';
import { resolve } from 'path';
import {
  hasTestModel,
  TEST_MODEL,
  TEST_TIMEOUT,
  getModelDisplayName
} from './test-helper';

// Paths (from tests/integration/ up to org/libs/)
const CHAT_SPACE = resolve(__dirname, '../../..', 'thing/spaces/space-chat');
const CHAT_AGENT = resolve(__dirname, '../../..', 'thing/spaces/space-chat/agents/agent-chat-assistant');

// Education space lives under store/spaces/ (from tests/integration/ up to monorepo root)
const EDU_SPACE = resolve(__dirname, '../../../../..', 'store/spaces/education');
const EDU_AGENT = resolve(__dirname, '../../../../..', 'store/spaces/education/agents/agent-assessment');

describe('defKnowledgeAgent Integration Tests', () => {
  const modelDisplay = getModelDisplayName(TEST_MODEL);

  // --- Basic agent (no flows) ---

  it.skipIf(!hasTestModel)(`registers ChatAssistant from space-chat (${modelDisplay})`, { timeout: TEST_TIMEOUT }, async () => {
    console.log(`\n=== Testing defKnowledgeAgent with ${modelDisplay} ===`);

    const { result } = await runPrompt(async ({ defKnowledgeAgent, $ }) => {
      defKnowledgeAgent(CHAT_SPACE, CHAT_AGENT);
      $`Use the ChatAssistant agent with chatMode set to "focused" and message "What models are best for coding tasks?"`;
    }, {
      model: TEST_MODEL,
      plugins: [knowledgeAgentPlugin]
    });

    const text = await result.text;
    console.log(`  > LLM Response: ${text}`);

    expect(text.length).toBeGreaterThan(0);
    console.log(`  > Test passed!\n`);
  });

  it.skipIf(!hasTestModel)(`injects knowledge context for selected mode (${modelDisplay})`, { timeout: TEST_TIMEOUT }, async () => {
    console.log(`\n=== Testing knowledge injection with ${modelDisplay} ===`);

    const { result } = await runPrompt(async ({ defKnowledgeAgent, $ }) => {
      defKnowledgeAgent(CHAT_SPACE, CHAT_AGENT);
      $`Use the ChatAssistant agent. Set chatMode to "creative" and ask: "How should I approach a brainstorming session?"`;
    }, {
      model: TEST_MODEL,
      plugins: [knowledgeAgentPlugin]
    });

    const text = await result.text;
    console.log(`  > LLM Response: ${text}`);

    expect(text.length).toBeGreaterThan(0);
    console.log(`  > Test passed!\n`);
  });

  it.skipIf(!hasTestModel)(`uses default values when no runtime fields specified (${modelDisplay})`, { timeout: TEST_TIMEOUT }, async () => {
    console.log(`\n=== Testing default values with ${modelDisplay} ===`);

    const { result } = await runPrompt(async ({ defKnowledgeAgent, $ }) => {
      defKnowledgeAgent(CHAT_SPACE, CHAT_AGENT);
      $`Use the ChatAssistant agent with the message "Give me a quick overview of what you can help with."`;
    }, {
      model: TEST_MODEL,
      plugins: [knowledgeAgentPlugin]
    });

    const text = await result.text;
    console.log(`  > LLM Response: ${text}`);

    expect(text.length).toBeGreaterThan(0);
    console.log(`  > Test passed!\n`);
  });

  // --- Slash action / flow execution ---

  it.skipIf(!hasTestModel)(`triggers assessment flow via /generate slash command (${modelDisplay})`, { timeout: 300_000 }, async () => {
    console.log(`\n=== Testing slash action flow with ${modelDisplay} ===`);

    const { result, prompt } = await runPrompt(async ({ defKnowledgeAgent, $ }) => {
      defKnowledgeAgent(EDU_SPACE, EDU_AGENT);
      $`Use the AssessmentAgent with message "/generate" to generate a short 5th-grade science quiz about photosynthesis.`;
    }, {
      model: TEST_MODEL,
      plugins: [knowledgeAgentPlugin]
    });

    const text = await result.text;
    console.log(`  > LLM Response (truncated): ${text.slice(0, 500)}`);

    // The flow should have produced multi-step output
    const steps = prompt.steps;
    console.log(`  > Total LLM steps: ${steps.length}`);

    // Flow has 6 steps — expect multiple tool calls (startTask, output_*, completeTask)
    const toolCalls = steps.flatMap((step: any) =>
      step.output?.content?.filter((c: any) => c.type === 'tool-call') || []
    );
    const toolNames = toolCalls.map((tc: any) => tc.toolName);
    console.log(`  > Tool calls: ${toolNames.join(', ')}`);

    // Should have called at least some output tools
    const outputToolCalls = toolNames.filter((n: string) => n.startsWith('output_'));
    expect(outputToolCalls.length).toBeGreaterThan(0);
    console.log(`  > Output tool calls: ${outputToolCalls.join(', ')}`);
    console.log(`  > Test passed!\n`);
  });
});
