/**
 * Markdown formatter for lmthing debug logs.
 *
 * Formats request/response data into human-readable markdown.
 */

import type { RequestData, ResponseData, LogEntry } from './types';

/**
 * Format a date as ISO string with timezone
 */
function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Escape markdown special characters
 */
function escapeMarkdown(text: string): string {
  // Don't escape code blocks - they're handled separately
  return text
    .replace(/\\/g, '\\\\')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format content from a message (can be string or array of parts)
 */
function formatMessageContent(content: string | Array<{ type: string; [key: string]: unknown }>): string {
  if (typeof content === 'string') {
    return escapeMarkdown(content);
  }

  return content.map(part => {
    if (part.type === 'text') {
      return escapeMarkdown(String(part.text || ''));
    } else if (part.type === 'tool-call') {
      return `\`[tool call: ${part.toolName}]\``;
    } else if (part.type === 'tool-result') {
      const output = part.output;
      if (output && typeof output === 'object') {
        if ('type' in output && output.type === 'text') {
          return `\`[tool result: ${part.toolName}] ${escapeMarkdown(String((output as any).value || ''))}\``;
        }
      }
      return `\`[tool result: ${part.toolName}]\``;
    }
    return `\`[${part.type}]\``;
  }).join('\n');
}

/**
 * Format a tool call for display
 */
function formatToolCall(toolCall: { name: string; toolCallId: string; args: Record<string, unknown> }): string {
  const argsStr = JSON.stringify(toolCall.args, null, 2);
  return `#### ${toolCall.name}

\`\`\`json
${argsStr}
\`\`\``;
}

/**
 * Format a tool result for display
 */
function formatToolResult(toolResult: { name: string; toolCallId: string; result: unknown }): string {
  const resultStr = typeof toolResult.result === 'string'
    ? toolResult.result
    : JSON.stringify(toolResult.result, null, 2);
  return `#### ${toolResult.name}

\`\`\`
${resultStr}
\`\`\``;
}

/**
 * Format the request section of a log entry
 */
export function formatRequest(request: RequestData): string {
  const lines: string[] = [];

  lines.push('## Request');
  lines.push('');

  // System Prompt
  if (request.systemPrompt) {
    lines.push('### System Prompt');
    lines.push('');
    lines.push('```xml');
    lines.push(request.systemPrompt);
    lines.push('```');
    lines.push('');
  }

  // Messages
  lines.push('### Messages');
  lines.push('');
  if (request.messages.length === 0) {
    lines.push('(No messages)');
  } else {
    request.messages.forEach((msg, i) => {
      lines.push(`${i + 1}. \`${msg.role}\`: ${formatMessageContent(msg.content)}`);
    });
  }
  lines.push('');

  // Tools
  lines.push('### Tools');
  lines.push('');
  const toolNames = Object.keys(request.tools);
  if (toolNames.length === 0) {
    lines.push('(None)');
  } else {
    toolNames.forEach(name => {
      const tool = request.tools[name];
      lines.push(`- \`${name}\`: ${tool.description}`);
    });
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format the response section of a log entry
 */
export function formatResponse(response: ResponseData): string {
  const lines: string[] = [];

  lines.push('## Response');
  lines.push('');

  // Text response
  if (response.text !== undefined) {
    lines.push('### Text');
    lines.push('');
    lines.push(response.text);
    lines.push('');
  }

  // Finish reason
  if (response.finishReason) {
    lines.push('### Finish Reason');
    lines.push('');
    lines.push(`\`${response.finishReason}\``);
    lines.push('');
  }

  // Tool calls
  if (response.toolCalls && response.toolCalls.length > 0) {
    lines.push('### Tool Calls');
    lines.push('');
    response.toolCalls.forEach(call => {
      lines.push(formatToolCall(call));
      lines.push('');
    });
  }

  // Tool results
  if (response.toolResults && response.toolResults.length > 0) {
    lines.push('### Tool Results');
    lines.push('');
    response.toolResults.forEach(result => {
      lines.push(formatToolResult(result));
      lines.push('');
    });
  }

  // Error
  if (response.error) {
    lines.push('### Error');
    lines.push('');
    lines.push(`\`\`\`\n${response.error}\n\`\`\``);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a complete log entry as markdown
 */
export function formatLogEntry(entry: LogEntry): string {
  const lines: string[] = [];

  // Header
  lines.push(`# lmthing Debug - Step ${entry.request.stepNumber}`);
  lines.push('');

  // Metadata
  lines.push('**Run ID**: `' + entry.runId + '`');
  lines.push('**Timestamp**: `' + formatDate(entry.request.timestamp) + '`');
  lines.push('**Model**: `' + entry.request.model + '`');
  lines.push('**Step**: ' + entry.request.stepNumber);
  lines.push('');

  lines.push('---');
  lines.push('');

  // Request
  lines.push(formatRequest(entry.request));

  // Response (if available)
  if (entry.response) {
    lines.push(formatResponse(entry.response));
  }

  return lines.join('\n');
}

/**
 * Format a simple console log message
 */
export function formatConsoleLog(entry: LogEntry): string {
  const parts = [
    `[LM_DEBUG] Run ${entry.runId} - Step ${entry.request.stepNumber}`,
    `[LM_DEBUG] Model: ${entry.request.model}`,
  ];

  if (entry.request.systemPrompt) {
    const preview = entry.request.systemPrompt.split('\n')[0].substring(0, 50);
    parts.push(`[LM_DEBUG] System: ${preview}...`);
  }

  parts.push(`[LM_DEBUG] Messages: ${entry.request.messages.length} messages`);

  const toolCount = Object.keys(entry.request.tools).length;
  parts.push(`[LM_DEBUG] Tools: ${toolCount} tools`);

  if (entry.response?.text) {
    const textPreview = entry.response.text.split('\n')[0].substring(0, 50);
    parts.push(`[LM_DEBUG] Response: "${textPreview}..."`);
  }

  if (entry.response?.toolCalls && entry.response.toolCalls.length > 0) {
    const callNames = entry.response.toolCalls.map(c => c.name).join(', ');
    parts.push(`[LM_DEBUG] Tool Calls: ${callNames}`);
  }

  return parts.join('\n');
}
