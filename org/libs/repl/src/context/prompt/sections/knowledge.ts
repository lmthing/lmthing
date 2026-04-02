/**
 * Knowledge section — knowledge tree with domain collapse support.
 */

import type { FocusController } from '../focus';

export function buildKnowledgeSection(
  knowledgeTree?: string,
  focus?: FocusController,
): string {
  // If no knowledge tree, return empty
  if (!knowledgeTree) {
    return '';
  }

  const isExpanded = focus ? focus.isExpanded('knowledge') : true;

  let content = '<available_knowledge>\n';

  if (isExpanded) {
    content += knowledgeTree;
  } else {
    // Count domains (lines starting with 2 spaces)
    const domainCount = (knowledgeTree.match(/^  /gm) ?? []).length;
    content += `(${domainCount} knowledge domains available — use focus("knowledge") to expand)`;
  }

  content += '\n</available_knowledge>';
  return content;
}
