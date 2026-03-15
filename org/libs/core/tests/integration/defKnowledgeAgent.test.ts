/**
 * LLM Integration Test for defKnowledgeAgent
 *
 * Tests the knowledge agent plugin with real LLMs against the
 * built-in space-chat agent structure.
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

// Paths to the built-in space-chat agent (from tests/integration/ up to org/libs/)
const SPACE_PATH = resolve(__dirname, '../../..', 'thing/spaces/space-chat');
const AGENT_PATH = resolve(__dirname, '../../..', 'thing/spaces/space-chat/agents/agent-chat-assistant');

describe('defKnowledgeAgent Integration Tests', () => {
  const modelDisplay = getModelDisplayName(TEST_MODEL);

  it.skipIf(!hasTestModel)(`registers ChatAssistant from space-chat (${modelDisplay})`, { timeout: TEST_TIMEOUT }, async () => {
    console.log(`\n=== Testing defKnowledgeAgent with ${modelDisplay} ===`);

    const { result } = await runPrompt(async ({ defKnowledgeAgent, $ }) => {
      defKnowledgeAgent(SPACE_PATH, AGENT_PATH);
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
      defKnowledgeAgent(SPACE_PATH, AGENT_PATH);
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
      defKnowledgeAgent(SPACE_PATH, AGENT_PATH);
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
});
