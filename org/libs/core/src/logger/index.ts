/**
 * Debug logger for lmthing.
 *
 * Provides comprehensive logging of prompts, responses, and tool calls.
 * Each run produces a single XML file with all steps, tool calls,
 * tool results, and agent logs in structured XML format.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type { DebugConfig, LogOutput, RequestData, ResponseData, LogEntry } from './types';
import { formatLogEntry, formatConsoleLog } from './formatter';
import { formatStepXml, formatRunHeader, formatRunFooter } from './xmlFormatter';

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
 * Logs are stored as a single XML file per run with all steps.
 */
export class DebugLogger {
  private _config: DebugConfig;
  private _runId: string | null = null;
  private _logFilePath: string | null = null;
  private _pendingRequests = new Map<number, RequestData>();
  private _headerWritten = false;
  private _model: string | null = null;
  // Serialize file writes to prevent interleaving from concurrent async observers
  private _writeQueue: Promise<void> = Promise.resolve();

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
   * Get the current log file path (null if not logging to file)
   */
  get logFilePath(): string | null {
    return this._logFilePath;
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
    this._headerWritten = false;
    this._model = null;
    this._writeQueue = Promise.resolve();

    // Create log directory and file path if logging to file or both
    if (this._config.output === 'file' || this._config.output === 'both') {
      const logDir = join(process.cwd(), this._config.logDir);
      await fs.mkdir(logDir, { recursive: true });
      this._logFilePath = join(logDir, `run-${this._runId}.xml`);
    }

    return this._runId;
  }

  /**
   * Append XML content to the log file (serialized to prevent interleaving).
   * Captures filePath/runId/model at call time so late-arriving writes
   * (from async observers) still go to the correct file.
   */
  private _appendToFile(content: string): Promise<void> {
    const filePath = this._logFilePath;
    const runId = this._runId;
    const model = this._model;
    if (!filePath || !runId) {
      return Promise.resolve();
    }
    this._writeQueue = this._writeQueue.then(async () => {
      // Write header lazily on first append
      if (!this._headerWritten) {
        const header = formatRunHeader(runId, model || undefined);
        await fs.writeFile(filePath, header + '\n', 'utf-8');
        this._headerWritten = true;
      }
      await fs.appendFile(filePath, content + '\n', 'utf-8');
    });
    return this._writeQueue;
  }

  /**
   * Log a request (prompt sent to the model)
   */
  async logRequest(request: RequestData): Promise<void> {
    if (!this._config.enabled || !this._runId) {
      return;
    }

    // Capture the model name from the first request
    if (!this._model) {
      this._model = request.model;
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

    // Write step XML to single file if file output enabled
    if (this._config.output === 'file' || this._config.output === 'both') {
      const stepXml = formatStepXml(entry);
      await this._appendToFile(stepXml);
    }

    // Clean up pending request
    this._pendingRequests.delete(response.stepNumber);
  }

  /**
   * End the current run and close the XML file
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
        const stepXml = formatStepXml(entry);
        await this._appendToFile(stepXml);
      }
    }

    // Write closing XML tag through the queue so it serializes after any late observer writes
    const filePath = this._logFilePath;
    if (filePath && (this._config.output === 'file' || this._config.output === 'both')) {
      this._writeQueue = this._writeQueue.then(async () => {
        await fs.appendFile(filePath, formatRunFooter(), 'utf-8');
      });
      await this._writeQueue;
    }

    this._runId = null;
    this._logFilePath = null;
    this._pendingRequests.clear();
    this._headerWritten = false;
    this._model = null;
    this._writeQueue = Promise.resolve();
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
