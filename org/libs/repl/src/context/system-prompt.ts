/**
 * Build the system prompt by replacing slot markers with content.
 */
export function buildSystemPrompt(
  template: string,
  slots: Record<string, string>,
): string {
  let result = template
  for (const [key, value] of Object.entries(slots)) {
    const marker = `{{${key}}}`
    result = result.replaceAll(marker, value)
  }
  return result
}

/**
 * Update just the {{SCOPE}} slot in an existing system prompt.
 */
export function updateScopeInPrompt(systemPrompt: string, scopeTable: string): string {
  // Match from {{SCOPE}} to the next {{ or end of string
  const scopeStart = systemPrompt.indexOf('{{SCOPE}}')
  if (scopeStart === -1) {
    // If no SCOPE marker, just return as-is
    return systemPrompt
  }

  // Replace the marker and any content until the next marker or end
  return systemPrompt.replace(
    /\{\{SCOPE\}\}[\s\S]*?(?=\{\{|$)/,
    scopeTable + '\n\n',
  )
}
