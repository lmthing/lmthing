/**
 * Rules section — execution rules for the agent.
 */

import type { FocusController } from '../focus';

const RULES = `<rule>Output ONLY valid TypeScript. No markdown. No prose outside // comments.</rule>
<rule>Plan before you build — call tasklist(tasklistId, description, tasks) to declare milestones with optional dependsOn for DAG dependencies, then call completeTask(tasklistId, taskId, output) or completeTaskAsync(tasklistId, taskId, fn) as you complete each one.</rule>
<rule>Await every async call: var x = await fn()</rule>
<rule>Use stop() to read runtime values before branching.</rule>
<rule>Do not use console.log — use stop() to inspect values.</rule>
<rule>Do not import modules. Do not use export.</rule>
<rule>Use var for all declarations (not const/let) so they persist in the REPL scope across turns.</rule>
<rule>Handle nullability with ?. and ??</rule>
<rule>After calling await stop(...), STOP. Do not write any more code until you receive the stop response.</rule>
<rule>Use loadKnowledge() to load relevant knowledge files before starting domain-specific work. Check the Knowledge Tree to see what is available. NEVER load all files from a domain or space — only select the specific options that are relevant to the user's request. Loading too much wastes context and degrades your performance.</rule>
<rule>To write a file, use a four-backtick write block (not writeFile()). To patch a file, read it first with readFile() then use a four-backtick diff block. If the host reports a FileError, adjust your diff context and retry.</rule>`;

export function buildRulesSection(focus?: FocusController): string {
  const isExpanded = focus ? focus.isExpanded('rules') : true;

  if (isExpanded) {
    return '<rules>\n' + RULES + '\n</rules>';
  }

  // Collapsed: show rule count
  const ruleCount = RULES.match(/<rule>/g)?.length ?? 11;
  return '<rules>\n(' + ruleCount + ' rules — see documentation)\n</rules>';
}
