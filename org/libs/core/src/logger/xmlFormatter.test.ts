/**
 * Tests for the XML formatter module
 */

import { describe, it, expect } from 'vitest';
import { formatStepXml, formatRunHeader, formatRunFooter, formatRunXml } from './xmlFormatter';
import type { LogEntry, RequestData, ResponseData } from './types';

function makeRequest(overrides: Partial<RequestData> = {}): RequestData {
  return {
    runId: 'test-run-123',
    stepNumber: 1,
    timestamp: new Date('2025-01-15T10:00:00Z'),
    model: 'openai:gpt-4o',
    messages: [{ role: 'user', content: 'Hello' }],
    tools: {},
    ...overrides,
  };
}

function makeResponse(overrides: Partial<ResponseData> = {}): ResponseData {
  return {
    stepNumber: 1,
    timestamp: new Date('2025-01-15T10:00:01Z'),
    text: 'Hi there!',
    finishReason: 'stop',
    ...overrides,
  };
}

function makeEntry(requestOverrides: Partial<RequestData> = {}, responseOverrides?: Partial<ResponseData> | null): LogEntry {
  const request = makeRequest(requestOverrides);
  return {
    runId: request.runId,
    stepNumber: request.stepNumber,
    request,
    response: responseOverrides === null ? undefined : makeResponse({ stepNumber: request.stepNumber, ...responseOverrides }),
  };
}

describe('xmlFormatter', () => {
  describe('formatRunHeader', () => {
    it('should produce valid XML header with run id', () => {
      const header = formatRunHeader('test-run-123');
      expect(header).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(header).toContain('<run id="test-run-123"');
      expect(header).toContain('timestamp=');
    });

    it('should include model attribute when provided', () => {
      const header = formatRunHeader('test-run-123', 'openai:gpt-4o');
      expect(header).toContain('model="openai:gpt-4o"');
    });

    it('should omit model attribute when not provided', () => {
      const header = formatRunHeader('test-run-123');
      expect(header).not.toContain('model=');
    });
  });

  describe('formatRunFooter', () => {
    it('should produce closing run tag', () => {
      expect(formatRunFooter()).toBe('</run>\n');
    });
  });

  describe('formatStepXml', () => {
    it('should wrap step with number attribute', () => {
      const xml = formatStepXml(makeEntry());
      expect(xml).toContain('<step number="1"');
      expect(xml).toContain('</step>');
    });

    it('should include timestamp and model in step tag', () => {
      const xml = formatStepXml(makeEntry());
      expect(xml).toContain('timestamp="2025-01-15T10:00:00.000Z"');
      expect(xml).toContain('model="openai:gpt-4o"');
    });

    it('should include system prompt', () => {
      const xml = formatStepXml(makeEntry({ systemPrompt: 'You are a helpful assistant.' }));
      expect(xml).toContain('<system>');
      expect(xml).toContain('You are a helpful assistant.');
      expect(xml).toContain('</system>');
    });

    it('should wrap system prompt in CDATA (preserves XML tags as-is)', () => {
      const xml = formatStepXml(makeEntry({ systemPrompt: '<role>Test & "quotes"</role>' }));
      expect(xml).toContain('<system><![CDATA[');
      expect(xml).toContain('<role>Test & "quotes"</role>');
      expect(xml).toContain(']]></system>');
    });

    it('should include tools with descriptions and schemas', () => {
      const xml = formatStepXml(makeEntry({
        tools: {
          search: {
            description: 'Search the web',
            inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
          },
          calculate: {
            description: 'Do math',
          },
        },
      }));
      expect(xml).toContain('<tools>');
      expect(xml).toContain('<tool name="search">');
      expect(xml).toContain('<description>Search the web</description>');
      expect(xml).toContain('<input_schema>');
      expect(xml).toContain('<tool name="calculate">');
      expect(xml).toContain('<description>Do math</description>');
      expect(xml).toContain('</tools>');
    });

    it('should include messages with roles', () => {
      const xml = formatStepXml(makeEntry({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      }));
      expect(xml).toContain('<messages>');
      expect(xml).toContain('<message role="user">');
      expect(xml).toContain('Hello');
      expect(xml).toContain('<message role="assistant">');
      expect(xml).toContain('Hi there!');
      expect(xml).toContain('</messages>');
    });

    it('should include text response', () => {
      const xml = formatStepXml(makeEntry({}, { text: 'The answer is 42.' }));
      expect(xml).toContain('<response>');
      expect(xml).toContain('<text>The answer is 42.</text>');
      expect(xml).toContain('</response>');
    });

    it('should include finish reason', () => {
      const xml = formatStepXml(makeEntry({}, { finishReason: 'tool-calls' }));
      expect(xml).toContain('<finish_reason>tool-calls</finish_reason>');
    });

    it('should include tool calls in response', () => {
      const xml = formatStepXml(makeEntry({}, {
        finishReason: 'tool-calls',
        text: undefined,
        toolCalls: [
          { name: 'search', toolCallId: 'call_1', args: { query: 'cats' } },
          { name: 'calculate', toolCallId: 'call_2', args: { a: 1, b: 2 } },
        ],
      }));
      expect(xml).toContain('<tool_calls>');
      expect(xml).toContain('<tool_call id="call_1" name="search">');
      expect(xml).toContain('<args>');
      expect(xml).toContain('cats');
      expect(xml).toContain('<tool_call id="call_2" name="calculate">');
      expect(xml).toContain('</tool_calls>');
    });

    it('should include tool results in response', () => {
      const xml = formatStepXml(makeEntry({}, {
        toolResults: [
          { name: 'search', toolCallId: 'call_1', result: { results: ['cat1', 'cat2'] } },
        ],
      }));
      expect(xml).toContain('<tool_results>');
      expect(xml).toContain('<tool_result id="call_1" name="search">');
      expect(xml).toContain('<result>');
      expect(xml).toContain('cat1');
      expect(xml).toContain('</tool_results>');
    });

    it('should include error in response', () => {
      const xml = formatStepXml(makeEntry({}, { error: 'Something went wrong' }));
      expect(xml).toContain('<error>Something went wrong</error>');
    });

    it('should handle entry without response', () => {
      const xml = formatStepXml(makeEntry({}, null));
      expect(xml).toContain('<step number="1"');
      expect(xml).not.toContain('<response>');
      expect(xml).toContain('</step>');
    });

    it('should handle messages with complex content (tool-call parts)', () => {
      const xml = formatStepXml(makeEntry({
        messages: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me search for that.' },
              { type: 'tool-call', toolCallId: 'call_1', toolName: 'search', input: { query: 'cats' } },
            ],
          },
        ],
      }));
      expect(xml).toContain('<text>Let me search for that.</text>');
      expect(xml).toContain('<tool_call id="call_1" name="search">');
    });

    it('should handle messages with tool-result parts', () => {
      const xml = formatStepXml(makeEntry({
        messages: [
          {
            role: 'tool',
            content: [
              { type: 'tool-result', toolCallId: 'call_1', toolName: 'search', output: { type: 'text', value: 'Found cats!' } },
            ],
          },
        ],
      }));
      expect(xml).toContain('<tool_result id="call_1" name="search">');
      expect(xml).toContain('<output>Found cats!</output>');
    });
  });

  describe('formatRunXml', () => {
    it('should produce a complete XML document with multiple steps', () => {
      const entries = [
        makeEntry({ stepNumber: 1 }, { stepNumber: 1 }),
        makeEntry({ stepNumber: 2 }, { stepNumber: 2, text: 'Second response' }),
      ];

      const xml = formatRunXml('test-run-123', entries, 'openai:gpt-4o');

      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<run id="test-run-123"');
      expect(xml).toContain('<step number="1"');
      expect(xml).toContain('<step number="2"');
      expect(xml).toContain('Second response');
      expect(xml).toContain('</run>');
    });

    it('should produce valid XML with no steps', () => {
      const xml = formatRunXml('test-run-123', []);
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<run id="test-run-123"');
      expect(xml).toContain('</run>');
    });
  });
});
