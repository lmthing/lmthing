/**
 * Agents section — agent spawning, respond, knowledge writer, and agent tree.
 */

import type { FocusController } from '../focus';

const AGENT_SPAWN_DOCS = `Spawn child agents from loaded spaces. Each call returns a Promise.
Use \`var result = space.agent(params).action(request)\` to track, or omit \`var\` for fire-and-forget.
Chain \`.options({ context: "branch" })\` to give the child your conversation history (default: "empty").

Tracked agents (saved to a variable) can call \`askParent(message, schema)\` to pause and ask you for input.
Their question appears as "? waiting" in {{AGENTS}} with the message and expected schema.
Answer with: \`respond(agentVariable, { key: value, ... })\`
Fire-and-forget agents (no variable) cannot ask questions.`;

const RESPOND_DOCS = `### respond(agentPromise, data) — Answer a child agent's question
When a tracked spawned agent calls askParent(), it pauses and surfaces a question in {{AGENTS}}.
Call respond() with the agent's variable and a data object matching the question's schema.

Example:
respond(steakInstructions, {
  doneness: "medium-rare",
  thickness_cm: 3,
})

The child resumes execution with the data as the return value of its askParent() call.`;

const KNOWLEDGE_WRITER_DOCS = `### knowledge.writer({ field }) — Persist knowledge and memories
The \`knowledge\` namespace is always available. Use it to save, update, or delete knowledge entries on disk. Writes are fire-and-forget — they complete in the background and the updated entries appear in the Knowledge Tree on subsequent turns.

The \`field\` parameter uses "domain/field" notation (e.g., \`"memory/project"\`, \`"cuisine/type"\`). If only one segment is given, it defaults to the \`memory\` domain.

Examples:
\`\`\`ts
// Save a project memory (fire-and-forget, no variable needed)
knowledge.writer({ field: "memory/project" }).save("auth-flow", "Authentication uses SSO codes with 60s TTL.")

// Save feedback
knowledge.writer({ field: "memory/feedback" }).save("testing-approach", "Use integration tests, not mocks.")

// Delete a memory
knowledge.writer({ field: "memory/feedback" }).remove("old-approach")

// Add multiple options from data
knowledge.writer({ field: "cuisine/type" }).addOptions("Store these recipes", recipeData, moreData)

// Load a saved memory (existing loadKnowledge global)
var mem = loadKnowledge({ "knowledge": { memory: { project: { "auth-flow": true } } } })
await stop(mem)
\`\`\``;

export function buildAgentsSection(
  agentTree?: string,
  knowledgeNamespacePrompt?: string,
  focus?: FocusController,
): string {
  const isExpanded = focus ? focus.isExpanded('agents') : true;

  // If no agent content, return empty
  if (!agentTree && !knowledgeNamespacePrompt) {
    return '';
  }

  let content = '<agents>\n';

  // Agent spawning documentation
  content += AGENT_SPAWN_DOCS + '\n\n';
  content += RESPOND_DOCS + '\n\n';
  content += KNOWLEDGE_WRITER_DOCS + '\n\n';

  // Agent tree and namespace
  content += '```\n';
  if (isExpanded) {
    const treeParts = [knowledgeNamespacePrompt, agentTree].filter(Boolean);
    if (treeParts.length > 0) {
      content += treeParts.join('\n');
    } else {
      content += '(no agents loaded)';
    }
  } else {
    content += '(agent tree collapsed — use focus("agents") to expand)';
  }
  content += '\n```\n';

  content += '</agents>';
  return content;
}
