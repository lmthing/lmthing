/**
 * XML formatter for lmthing debug logs.
 *
 * Formats request/response data into a single XML file per run.
 * Each step is wrapped in a <step> tag with system prompts, tools,
 * messages, tool calls, tool results, and agent logs.
 */

import type { RequestData, ResponseData, LogEntry } from './types';

/**
 * Escape special XML characters in text content.
 * Only escapes &, <, > — quotes are fine in element content.
 */
function escapeXml(text: unknown): string {
  if (text === null || text === undefined) return '';
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape special XML characters in attribute values (also escapes quotes).
 */
function escapeAttr(text: unknown): string {
  if (text === null || text === undefined) return '';
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Indent each line of text by a given number of spaces
 */
function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map(line => pad + line)
    .join('\n');
}

/**
 * Format a value as XML - handles objects, arrays, and primitives
 */
function formatValue(value: unknown, indentLevel: number = 0): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return escapeXml(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return escapeXml(JSON.stringify(value, null, 2));
}

/**
 * Format message content (string or array of parts) as XML
 */
function formatMessageContent(content: string | Array<{ type: string; [key: string]: unknown }>, indentLevel: number): string {
  if (typeof content === 'string') {
    return indent(`<content>${escapeXml(content)}</content>`, indentLevel);
  }

  const parts = content.map(part => {
    if (part.type === 'text') {
      return indent(`<text>${escapeXml(String(part.text || ''))}</text>`, indentLevel + 2);
    } else if (part.type === 'tool-call') {
      const lines = [
        `<tool_call id="${escapeAttr(String(part.toolCallId || ''))}" name="${escapeAttr(String(part.toolName || ''))}">`,
        indent(`<input>${formatValue(part.input)}</input>`, 2),
        `</tool_call>`
      ];
      return indent(lines.join('\n'), indentLevel + 2);
    } else if (part.type === 'tool-result') {
      const output = part.output;
      let outputStr: string;
      if (output && typeof output === 'object' && 'type' in output) {
        outputStr = formatValue((output as any).value);
      } else {
        outputStr = formatValue(output);
      }
      const lines = [
        `<tool_result id="${escapeAttr(String(part.toolCallId || ''))}" name="${escapeAttr(String(part.toolName || ''))}">`,
        indent(`<output>${outputStr}</output>`, 2),
        `</tool_result>`
      ];
      // Include agent steps if present
      if (part.agentSteps && Array.isArray(part.agentSteps)) {
        lines.splice(lines.length - 1, 0, formatAgentSteps(part.agentSteps as any[], indentLevel + 4));
      }
      return indent(lines.join('\n'), indentLevel + 2);
    }
    return indent(`<part type="${escapeAttr(part.type)}">${formatValue(part)}</part>`, indentLevel + 2);
  });

  return indent('<content>\n', indentLevel) + parts.join('\n') + '\n' + indent('</content>', indentLevel);
}

/**
 * Format agent steps as nested XML
 */
function formatAgentSteps(steps: any[], baseIndent: number): string {
  if (!steps || steps.length === 0) return '';

  const lines: string[] = [];
  lines.push(indent('<agent_log>', baseIndent));

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    lines.push(indent(`<step number="${i + 1}">`, baseIndent + 2));

    // Input messages
    if (step.input?.prompt) {
      lines.push(indent('<messages>', baseIndent + 4));
      for (const msg of step.input.prompt) {
        lines.push(indent(`<message role="${escapeAttr(msg.role)}">`, baseIndent + 6));
        lines.push(formatMessageContent(msg.content, baseIndent + 8));
        lines.push(indent('</message>', baseIndent + 6));
      }
      lines.push(indent('</messages>', baseIndent + 4));
    }

    // Output
    if (step.output) {
      lines.push(indent('<output>', baseIndent + 4));
      if (step.output.content) {
        for (const item of step.output.content) {
          if (item.type === 'text') {
            lines.push(indent(`<text>${escapeXml(item.text || '')}</text>`, baseIndent + 6));
          } else if (item.type === 'tool-call') {
            lines.push(indent(
              `<tool_call id="${escapeAttr(item.toolCallId || '')}" name="${escapeAttr(item.toolName || '')}">`,
              baseIndent + 6
            ));
            lines.push(indent(`<input>${formatValue(item.input)}</input>`, baseIndent + 8));
            lines.push(indent('</tool_call>', baseIndent + 6));
          }
        }
      }
      if (step.output.finishReason) {
        lines.push(indent(`<finish_reason>${escapeXml(step.output.finishReason)}</finish_reason>`, baseIndent + 6));
      }
      lines.push(indent('</output>', baseIndent + 4));
    }

    lines.push(indent('</step>', baseIndent + 2));
  }

  lines.push(indent('</agent_log>', baseIndent));
  return lines.join('\n');
}

/**
 * Format a single step's request as XML
 */
function formatRequestXml(request: RequestData, indentLevel: number): string {
  const lines: string[] = [];

  // System prompt — wrapped in CDATA since it often contains XML tags
  if (request.systemPrompt) {
    lines.push(indent('<system><![CDATA[', indentLevel));
    lines.push(indent(request.systemPrompt, indentLevel + 2));
    lines.push(indent(']]></system>', indentLevel));
  }

  // Tools
  const toolNames = Object.keys(request.tools);
  if (toolNames.length > 0) {
    lines.push(indent('<tools>', indentLevel));
    for (const name of toolNames) {
      const tool = request.tools[name];
      lines.push(indent(`<tool name="${escapeAttr(name)}">`, indentLevel + 2));
      lines.push(indent(`<description>${escapeXml(tool.description)}</description>`, indentLevel + 4));
      if (tool.inputSchema) {
        lines.push(indent(`<input_schema>${formatValue(tool.inputSchema)}</input_schema>`, indentLevel + 4));
      }
      lines.push(indent('</tool>', indentLevel + 2));
    }
    lines.push(indent('</tools>', indentLevel));
  }

  // Messages
  if (request.messages.length > 0) {
    lines.push(indent('<messages>', indentLevel));
    for (const msg of request.messages) {
      lines.push(indent(`<message role="${escapeAttr(msg.role)}">`, indentLevel + 2));
      lines.push(formatMessageContent(msg.content, indentLevel + 4));
      lines.push(indent('</message>', indentLevel + 2));
    }
    lines.push(indent('</messages>', indentLevel));
  }

  return lines.join('\n');
}

/**
 * Format a single step's response as XML
 */
function formatResponseXml(response: ResponseData, indentLevel: number): string {
  const lines: string[] = [];

  lines.push(indent('<response>', indentLevel));

  // Text response
  if (response.text !== undefined && response.text !== '') {
    lines.push(indent(`<text>${escapeXml(response.text)}</text>`, indentLevel + 2));
  }

  // Finish reason
  if (response.finishReason) {
    lines.push(indent(`<finish_reason>${escapeXml(response.finishReason)}</finish_reason>`, indentLevel + 2));
  }

  // Tool calls
  if (response.toolCalls && response.toolCalls.length > 0) {
    lines.push(indent('<tool_calls>', indentLevel + 2));
    for (const call of response.toolCalls) {
      lines.push(indent(
        `<tool_call id="${escapeAttr(call.toolCallId)}" name="${escapeAttr(call.name)}">`,
        indentLevel + 4
      ));
      lines.push(indent(`<args>${formatValue(call.args)}</args>`, indentLevel + 6));
      lines.push(indent('</tool_call>', indentLevel + 4));
    }
    lines.push(indent('</tool_calls>', indentLevel + 2));
  }

  // Tool results
  if (response.toolResults && response.toolResults.length > 0) {
    lines.push(indent('<tool_results>', indentLevel + 2));
    for (const result of response.toolResults) {
      lines.push(indent(
        `<tool_result id="${escapeAttr(result.toolCallId)}" name="${escapeAttr(result.name)}">`,
        indentLevel + 4
      ));
      lines.push(indent(`<result>${formatValue(result.result)}</result>`, indentLevel + 6));
      lines.push(indent('</tool_result>', indentLevel + 4));
    }
    lines.push(indent('</tool_results>', indentLevel + 2));
  }

  // Error
  if (response.error) {
    lines.push(indent(`<error>${escapeXml(response.error)}</error>`, indentLevel + 2));
  }

  lines.push(indent('</response>', indentLevel));

  return lines.join('\n');
}

/**
 * Format a complete step entry as XML
 */
export function formatStepXml(entry: LogEntry): string {
  const lines: string[] = [];

  lines.push(`  <step number="${entry.stepNumber}" timestamp="${entry.request.timestamp.toISOString()}" model="${escapeAttr(entry.request.model)}">`);

  // Request data
  lines.push(formatRequestXml(entry.request, 4));

  // Response data
  if (entry.response) {
    lines.push(formatResponseXml(entry.response, 4));
  }

  lines.push('  </step>');

  return lines.join('\n');
}

/**
 * Format the XML document header for a run
 */
export function formatRunHeader(runId: string, model?: string): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  const modelAttr = model ? ` model="${escapeAttr(model)}"` : '';
  lines.push(`<run id="${escapeAttr(runId)}" timestamp="${new Date().toISOString()}"${modelAttr}>`);
  return lines.join('\n');
}

/**
 * Format the XML document footer
 */
export function formatRunFooter(): string {
  return '</run>\n';
}

/**
 * Format a complete run as a single XML document from all entries
 */
export function formatRunXml(runId: string, entries: LogEntry[], model?: string): string {
  const lines: string[] = [];

  lines.push(formatRunHeader(runId, model));

  for (const entry of entries) {
    lines.push(formatStepXml(entry));
  }

  lines.push(formatRunFooter());

  return lines.join('\n');
}

// Re-export the agent steps formatter for use by the logger
export { formatAgentSteps };
