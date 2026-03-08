/**
 * Logger module types for lmthing debugging and logging.
 *
 * Provides interfaces for debug configuration, log levels, and log entries.
 */

/**
 * Log output mode - where to send debug output
 */
export type LogOutput = 'console' | 'file' | 'both';

/**
 * Log detail level - how much information to include
 */
export type LogLevel = 'minimal' | 'prompts' | 'full';

/**
 * Debug configuration options
 */
export interface DebugConfig {
  /** Whether debugging is enabled */
  enabled: boolean;
  /** Where to log output (console, file, or both) */
  output: LogOutput;
  /** Directory for log files, relative to CWD */
  logDir: string;
  /** Level of detail to include in logs */
  level: LogLevel;
}

/**
 * Tool call information for logging
 */
export interface ToolCallInfo {
  /** Tool name */
  name: string;
  /** Tool call ID */
  toolCallId: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
}

/**
 * Tool result information for logging
 */
export interface ToolResultInfo {
  /** Tool name */
  name: string;
  /** Tool call ID */
  toolCallId: string;
  /** Result returned by the tool */
  result: unknown;
}

/**
 * Request data captured for logging
 */
export interface RequestData {
  /** Run ID for this prompt execution */
  runId: string;
  /** Step number (1-indexed) */
  stepNumber: number;
  /** Timestamp when the request was made */
  timestamp: Date;
  /** Model being used (e.g., 'openai:gpt-4o') */
  model: string;
  /** System prompt */
  systemPrompt?: string;
  /** Messages sent to the model */
  messages: Array<{
    role: string;
    content: string | Array<{ type: string; [key: string]: unknown }>;
  }>;
  /** Tools available to the model */
  tools: Record<string, {
    description: string;
    inputSchema?: unknown;
  }>;
}

/**
 * Response data captured for logging
 */
export interface ResponseData {
  /** Step number */
  stepNumber: number;
  /** Timestamp when the response was received */
  timestamp: Date;
  /** Text response from the model */
  text?: string;
  /** Finish reason (stop, tool-calls, etc.) */
  finishReason?: string;
  /** Tool calls made by the model */
  toolCalls?: ToolCallInfo[];
  /** Tool results received */
  toolResults?: ToolResultInfo[];
  /** Any errors that occurred */
  error?: string;
}

/**
 * Complete log entry for a single step
 */
export interface LogEntry {
  /** Run ID */
  runId: string;
  /** Step number */
  stepNumber: number;
  /** Request data */
  request: RequestData;
  /** Response data (optional if not yet received) */
  response?: ResponseData;
}
