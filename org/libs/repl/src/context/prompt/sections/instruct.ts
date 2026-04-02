/**
 * Instruct section — custom instructions for agent behavior.
 */

export function buildInstructSection(instruct?: string): string {
  if (!instruct) {
    return '';
  }

  return '<instructions>\n' + instruct + '\n</instructions>';
}
