/**
 * Debug logger for lmthing.
 *
 * Provides comprehensive logging of prompts, responses, and tool calls.
 * Logs to console and/or markdown files for later review.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type { DebugConfig, LogOutput, RequestData, ResponseData, LogEntry } from './types';
import { formatLogEntry, formatConsoleLog } from './formatter';

/**
 * Generate a unique run ID with timestamp
 */
function generateRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Default debug configuration
 */
const DEFAULT_CONFIG: DebugConfig = {
  enabled: false,
  output: 'both',
  logDir: 'logs',
  level: 'full',
};

/**
 * Parse debug config from environment variables
 */
function getConfigFromEnv(): Partial<DebugConfig> {
  const debug = process.env.LM_DEBUG;
  const output = process.env.LM_DEBUG_OUTPUT;
  const logDir = process.env.LM_DEBUG_DIR;
  const level = process.env.LM_DEBUG_LEVEL;

  return {
    enabled: debug === 'true' || debug === '1',
    output: (output === 'console' || output === 'file' || output === 'both') ? output : DEFAULT_CONFIG.output,
    logDir: logDir || DEFAULT_CONFIG.logDir,
    level: (level === 'minimal' || level === 'prompts' || level === 'full') ? level : DEFAULT_CONFIG.level,
  };
}

/**
 * Debug logger class for capturing and storing lmthing execution logs.
 *
 * Implements singleton pattern to share state across all prompts.
 * Logs are stored as markdown files in a run-specific directory.
 */
export class DebugLogger {
  private _config: DebugConfig;
  private _runId: string | null = null;
  private _currentRunDir: string | null = null;
  private _pendingRequests = new Map<number, RequestData>();

  constructor(config?: Partial<DebugConfig>) {
    const envConfig = getConfigFromEnv();
    this._config = { ...DEFAULT_CONFIG, ...envConfig, ...config };
  }

  /**
   * Get or create the singleton logger instance
   */
  private static _instance: DebugLogger | null = null;

  static getInstance(config?: Partial<DebugConfig>): DebugLogger {
    if (!DebugLogger._instance) {
      DebugLogger._instance = new DebugLogger(config);
    }
    return DebugLogger._instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    DebugLogger._instance = null;
  }

  /**
   * Check if debugging is enabled
   */
  get enabled(): boolean {
    return this._config.enabled;
  }

  /**
   * Get the current run ID
   */
  get runId(): string | null {
    return this._runId;
  }

  /**
   * Get the current configuration
   */
  get config(): DebugConfig {
    return { ...this._config };
  }

  /**
   * Start a new run with a unique ID
   */
  async startRun(): Promise<string> {
    if (!this._config.enabled) {
      this._runId = generateRunId();
      return this._runId;
    }

    this._runId = generateRunId();
    this._pendingRequests.clear();

    // Create run directory if logging to file or both
    if (this._config.output === 'file' || this._config.output === 'both') {
      const runDir = join(process.cwd(), this._config.logDir, `run-${this._runId}`);
      await fs.mkdir(runDir, { recursive: true });
      this._currentRunDir = runDir;
    }

    return this._runId;
  }

  /**
   * Log a request (prompt sent to the model)
   */
  async logRequest(request: RequestData): Promise<void> {
    if (!this._config.enabled || !this._runId) {
      return;
    }

    // Store the request for later pairing with response
    this._pendingRequests.set(request.stepNumber, request);

    // Log to console if enabled
    if (this._config.output === 'console' || this._config.output === 'both') {
      console.log(`[LM_DEBUG] Step ${request.stepNumber} - Request`);
      console.log(`[LM_DEBUG] Model: ${request.model}`);
      console.log(`[LM_DEBUG] Messages: ${request.messages.length} messages`);
      console.log(`[LM_DEBUG] Tools: ${Object.keys(request.tools).length} tools`);
    }

    // For minimal level, don't write file yet (wait for response)
    if (this._config.level === 'minimal') {
      return;
    }

    // Write prompts-only log immediately if at prompts level
    if (this._config.level === 'prompts' && (this._config.output === 'file' || this._config.output === 'both')) {
      await this._writeStepFile(request.stepNumber, { runId: this._runId, stepNumber: request.stepNumber, request });
    }
  }

  /**
   * Log a response (received from the model)
   */
  async logResponse(response: ResponseData): Promise<void> {
    if (!this._config.enabled || !this._runId) {
      return;
    }

    // Get the corresponding request
    const request = this._pendingRequests.get(response.stepNumber);
    if (!request) {
      // No request stored, can't create complete log
      return;
    }

    // Create complete log entry
    const entry: LogEntry = {
      runId: this._runId,
      stepNumber: response.stepNumber,
      request,
      response,
    };

    // Log to console if enabled
    if (this._config.output === 'console' || this._config.output === 'both') {
      console.log(`[LM_DEBUG] Step ${response.stepNumber} - Response`);
      if (response.text) {
        const preview = response.text.split('\n')[0].substring(0, 50);
        console.log(`[LM_DEBUG] Response: "${preview}${response.text.length > 50 ? '...' : ''}"`);
      }
      if (response.finishReason) {
        console.log(`[LM_DEBUG] Finish: ${response.finishReason}`);
      }
      if (response.toolCalls && response.toolCalls.length > 0) {
        const callNames = response.toolCalls.map(c => c.name).join(', ');
        console.log(`[LM_DEBUG] Tool Calls: ${callNames}`);
      }
      console.log('');
    }

    // Write to file if enabled
    if (this._config.output === 'file' || this._config.output === 'both') {
      await this._writeStepFile(response.stepNumber, entry);
    }

    // Clean up pending request
    this._pendingRequests.delete(response.stepNumber);
  }

  /**
   * Write a step log file
   */
  private async _writeStepFile(stepNumber: number, entry: LogEntry): Promise<void> {
    if (!this._currentRunDir) {
      return;
    }

    const filename = `step-${stepNumber}.md`;
    const filepath = join(this._currentRunDir, filename);
    const content = formatLogEntry(entry);

    await fs.writeFile(filepath, content, 'utf-8');
  }

  /**
   * End the current run and clean up
   */
  async endRun(): Promise<void> {
    if (!this._config.enabled) {
      this._runId = null;
      this._pendingRequests.clear();
      return;
    }

    // Write any pending requests without responses
    if (this._pendingRequests.size > 0 && (this._config.output === 'file' || this._config.output === 'both')) {
      for (const [stepNumber, request] of this._pendingRequests) {
        const entry: LogEntry = {
          runId: this._runId!,
          stepNumber,
          request,
          response: undefined,
        };
        await this._writeStepFile(stepNumber, entry);
      }
    }

    this._runId = null;
    this._currentRunDir = null;
    this._pendingRequests.clear();
  }

  /**
   * Update configuration (useful for runtime changes)
   */
  updateConfig(config: Partial<DebugConfig>): void {
    this._config = { ...this._config, ...config };
  }
}

/**
 * Get the global logger instance
 */
export function getDebugLogger(): DebugLogger {
  return DebugLogger.getInstance();
}

/**
 * Create a new debug logger with custom configuration
 */
export function createDebugLogger(config: Partial<DebugConfig>): DebugLogger {
  return new DebugLogger(config);
}

// Re-export types
export type { DebugConfig, LogOutput, LogLevel, RequestData, ResponseData, LogEntry } from './types';
