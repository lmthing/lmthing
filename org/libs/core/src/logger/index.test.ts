/**
 * Tests for the debug logger module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { DebugLogger, getDebugLogger, createDebugLogger, type DebugConfig } from './index';
import type { RequestData, ResponseData } from './types';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    appendFile: vi.fn(),
  },
}));

describe('DebugLogger', () => {
  beforeEach(() => {
    // Reset the singleton before each test
    DebugLogger.reset();
    // Clear any environment variables that might affect tests
    delete process.env.LM_DEBUG;
    delete process.env.LM_DEBUG_OUTPUT;
    delete process.env.LM_DEBUG_DIR;
    delete process.env.LM_DEBUG_LEVEL;
    vi.clearAllMocks();
  });

  afterEach(() => {
    DebugLogger.reset();
  });

  describe('singleton pattern', () => {
    it('should return the same instance across multiple calls', () => {
      const logger1 = getDebugLogger();
      const logger2 = getDebugLogger();
      expect(logger1).toBe(logger2);
    });

    it('should reset to a new instance after reset()', () => {
      const logger1 = getDebugLogger();
      DebugLogger.reset();
      const logger2 = getDebugLogger();
      expect(logger1).not.toBe(logger2);
    });
  });

  describe('configuration', () => {
    it('should have default config with disabled logging', () => {
      DebugLogger.reset();
      delete process.env.LM_DEBUG;
      const logger = getDebugLogger();
      expect(logger.enabled).toBe(false);
    });

    it('should enable logging when LM_DEBUG env var is true', () => {
      DebugLogger.reset();
      process.env.LM_DEBUG = 'true';
      const logger = getDebugLogger();
      expect(logger.enabled).toBe(true);
      delete process.env.LM_DEBUG;
      DebugLogger.reset();
    });

    it('should allow runtime config updates', () => {
      const logger = getDebugLogger();
      expect(logger.enabled).toBe(false);

      logger.updateConfig({ enabled: true });
      expect(logger.enabled).toBe(true);
    });

    it('should respect all config options', () => {
      const logger = createDebugLogger({
        enabled: true,
        output: 'console',
        logDir: 'test-logs',
        level: 'minimal',
      });

      expect(logger.enabled).toBe(true);
      expect(logger.config).toEqual({
        enabled: true,
        output: 'console',
        logDir: 'test-logs',
        level: 'minimal',
      });
    });
  });

  describe('run management', () => {
    it('should generate a unique run ID', async () => {
      const logger = createDebugLogger({ enabled: false });
      const runId1 = await logger.startRun();
      const runId2 = await logger.startRun();

      expect(runId1).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-[a-z0-9]{6}$/);
      expect(runId2).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-[a-z0-9]{6}$/);
      expect(runId1).not.toBe(runId2);
    });

    it('should create log directory when file output is enabled', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'file', logDir: 'test-logs' });

      await logger.startRun();
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('test-logs'),
        { recursive: true }
      );
    });

    it('should set log file path as single XML file', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'file', logDir: 'test-logs' });

      const runId = await logger.startRun();
      expect(logger.logFilePath).toContain(`run-${runId}.xml`);
    });

    it('should not create directory when console-only output', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'console', logDir: 'test-logs' });

      await logger.startRun();
      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('XML file output', () => {
    it('should write XML header on first step', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'file', logDir: 'test-logs' });
      const runId = await logger.startRun();

      const request: RequestData = {
        runId,
        stepNumber: 1,
        timestamp: new Date(),
        model: 'openai:gpt-4o',
        systemPrompt: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: {},
      };

      const response: ResponseData = {
        stepNumber: 1,
        timestamp: new Date(),
        text: 'Hello World!',
        finishReason: 'stop',
      };

      await logger.logRequest(request);
      await logger.logResponse(response);

      // Header should be written first via writeFile
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      const headerCall = (fs.writeFile as any).mock.calls[0];
      expect(headerCall[0]).toContain('.xml');
      expect(headerCall[1]).toContain('<?xml version="1.0"');
      expect(headerCall[1]).toContain(`<run id="${runId}"`);
      expect(headerCall[1]).toContain('model="openai:gpt-4o"');

      // Step should be appended via appendFile
      expect(fs.appendFile).toHaveBeenCalledTimes(1);
      const stepCall = (fs.appendFile as any).mock.calls[0];
      expect(stepCall[1]).toContain('<step number="1"');
      expect(stepCall[1]).toContain('<system>');
      expect(stepCall[1]).toContain('<response>');
      expect(stepCall[1]).toContain('<text>Hello World!</text>');
      expect(stepCall[1]).toContain('<finish_reason>stop</finish_reason>');
    });

    it('should append multiple steps to the same file', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'file', logDir: 'test-logs' });
      const runId = await logger.startRun();

      // Step 1
      await logger.logRequest({
        runId, stepNumber: 1, timestamp: new Date(),
        model: 'openai:gpt-4o', messages: [{ role: 'user', content: 'Hello' }],
        tools: {},
      });
      await logger.logResponse({
        stepNumber: 1, timestamp: new Date(),
        text: 'Hi there!', finishReason: 'stop',
      });

      // Step 2
      await logger.logRequest({
        runId, stepNumber: 2, timestamp: new Date(),
        model: 'openai:gpt-4o', messages: [{ role: 'user', content: 'How are you?' }],
        tools: {},
      });
      await logger.logResponse({
        stepNumber: 2, timestamp: new Date(),
        text: 'I am fine!', finishReason: 'stop',
      });

      // Header written once, two steps appended
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.appendFile).toHaveBeenCalledTimes(2);

      const step1 = (fs.appendFile as any).mock.calls[0][1];
      expect(step1).toContain('<step number="1"');

      const step2 = (fs.appendFile as any).mock.calls[1][1];
      expect(step2).toContain('<step number="2"');
    });

    it('should include tool calls and tool results in XML', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'file', logDir: 'test-logs' });
      const runId = await logger.startRun();

      await logger.logRequest({
        runId, stepNumber: 1, timestamp: new Date(),
        model: 'openai:gpt-4o',
        messages: [{ role: 'user', content: 'Search for cats' }],
        tools: {
          search: { description: 'Search the web', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
        },
      });
      await logger.logResponse({
        stepNumber: 1, timestamp: new Date(),
        finishReason: 'tool-calls',
        toolCalls: [
          { name: 'search', toolCallId: 'call_1', args: { query: 'cats' } },
        ],
        toolResults: [
          { name: 'search', toolCallId: 'call_1', result: { results: ['cat1', 'cat2'] } },
        ],
      });

      const stepXml = (fs.appendFile as any).mock.calls[0][1];
      expect(stepXml).toContain('<tools>');
      expect(stepXml).toContain('<tool name="search">');
      expect(stepXml).toContain('<description>Search the web</description>');
      expect(stepXml).toContain('<tool_calls>');
      expect(stepXml).toContain('<tool_call id="call_1" name="search">');
      expect(stepXml).toContain('<tool_results>');
      expect(stepXml).toContain('<tool_result id="call_1" name="search">');
    });

    it('should write closing tag on endRun', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'file', logDir: 'test-logs' });
      const runId = await logger.startRun();

      await logger.logRequest({
        runId, stepNumber: 1, timestamp: new Date(),
        model: 'openai:gpt-4o', messages: [{ role: 'user', content: 'Hello' }],
        tools: {},
      });
      await logger.logResponse({
        stepNumber: 1, timestamp: new Date(),
        text: 'Hi!', finishReason: 'stop',
      });

      await logger.endRun();

      // Last appendFile call should be the closing </run> tag
      const lastCall = (fs.appendFile as any).mock.calls[(fs.appendFile as any).mock.calls.length - 1];
      expect(lastCall[1]).toContain('</run>');
    });

    it('should include system prompt in XML', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'file', logDir: 'test-logs' });
      const runId = await logger.startRun();

      await logger.logRequest({
        runId, stepNumber: 1, timestamp: new Date(),
        model: 'openai:gpt-4o',
        systemPrompt: '<role>\nYou are a helpful assistant.\n</role>',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: {},
      });
      await logger.logResponse({
        stepNumber: 1, timestamp: new Date(),
        text: 'Hi!', finishReason: 'stop',
      });

      const stepXml = (fs.appendFile as any).mock.calls[0][1];
      expect(stepXml).toContain('<system><![CDATA[');
      expect(stepXml).toContain('<role>');
      expect(stepXml).toContain('You are a helpful assistant.');
      expect(stepXml).toContain(']]></system>');
    });
  });

  describe('request logging', () => {
    it('should not log when disabled', async () => {
      const logger = createDebugLogger({ enabled: false, output: 'both' });
      const runId = await logger.startRun();

      const request: RequestData = {
        runId,
        stepNumber: 1,
        timestamp: new Date(),
        model: 'openai:gpt-4o',
        systemPrompt: '<role>Test</role>',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: {},
      };

      await logger.logRequest(request);
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(fs.appendFile).not.toHaveBeenCalled();
    });

    it('should log request to console when console output enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createDebugLogger({ enabled: true, output: 'console' });
      const runId = await logger.startRun();

      const request: RequestData = {
        runId,
        stepNumber: 1,
        timestamp: new Date(),
        model: 'openai:gpt-4o',
        systemPrompt: '<role>Test</role>',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: {},
      };

      await logger.logRequest(request);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LM_DEBUG]')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('response logging', () => {
    it('should log response paired with request', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createDebugLogger({ enabled: true, output: 'console' });
      const runId = await logger.startRun();

      const request: RequestData = {
        runId,
        stepNumber: 1,
        timestamp: new Date(),
        model: 'openai:gpt-4o',
        systemPrompt: '<role>Test</role>',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: {},
      };

      const response: ResponseData = {
        stepNumber: 1,
        timestamp: new Date(),
        text: 'Hello World!',
        finishReason: 'stop',
      };

      await logger.logRequest(request);
      await logger.logResponse(response);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LM_DEBUG]')
      );
      consoleSpy.mockRestore();
    });

    it('should include tool calls in response', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createDebugLogger({ enabled: true, output: 'console' });
      const runId = await logger.startRun();

      const request: RequestData = {
        runId,
        stepNumber: 1,
        timestamp: new Date(),
        model: 'openai:gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: {},
      };

      const response: ResponseData = {
        stepNumber: 1,
        timestamp: new Date(),
        finishReason: 'tool-calls',
        toolCalls: [
          { name: 'search', toolCallId: 'call_1', args: { query: 'test' } },
        ],
      };

      await logger.logRequest(request);
      await logger.logResponse(response);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool Calls: search')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('end run', () => {
    it('should clean up state on end', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'console' });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const runId = await logger.startRun();

      const request: RequestData = {
        runId,
        stepNumber: 1,
        timestamp: new Date(),
        model: 'openai:gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: {},
      };

      await logger.logRequest(request);
      await logger.endRun();

      expect(logger.runId).toBe(null);
      expect(logger.logFilePath).toBe(null);
      consoleSpy.mockRestore();
    });

    it('should write pending requests without responses on endRun', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'file', logDir: 'test-logs' });
      const runId = await logger.startRun();

      await logger.logRequest({
        runId, stepNumber: 1, timestamp: new Date(),
        model: 'openai:gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: {},
      });

      // End without logging response
      await logger.endRun();

      // Header + pending step should be written, then closing tag
      expect(fs.writeFile).toHaveBeenCalledTimes(1); // header
      expect(fs.appendFile).toHaveBeenCalledTimes(2); // step + closing tag
      const stepCall = (fs.appendFile as any).mock.calls[0][1];
      expect(stepCall).toContain('<step number="1"');
      const closingCall = (fs.appendFile as any).mock.calls[1][1];
      expect(closingCall).toContain('</run>');
    });
  });
});
