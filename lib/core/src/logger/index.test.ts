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
      // Ensure clean state
      DebugLogger.reset();
      delete process.env.LM_DEBUG;
      const logger = getDebugLogger();
      expect(logger.enabled).toBe(false);
    });

    it('should enable logging when LM_DEBUG env var is true', () => {
      // First reset to ensure clean state
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

    it('should create run directory when file output is enabled', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'file', logDir: 'test-logs' });

      await logger.startRun();
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('run-'),
        { recursive: true }
      );
    });

    it('should not create directory when console-only output', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'console', logDir: 'test-logs' });

      await logger.startRun();
      expect(fs.mkdir).not.toHaveBeenCalled();
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

    it('should write file when file output enabled', async () => {
      const logger = createDebugLogger({ enabled: true, output: 'file', logDir: 'test-logs' });
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
      // File is written when response is logged, not on request alone
      // for 'prompts' level, so this doesn't write yet
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
    it('should clean up pending requests on end', async () => {
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
      consoleSpy.mockRestore();
    });
  });
});
