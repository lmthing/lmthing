/**
 * Static checks for a draft tasklist DAG: unknown dependsOn targets and dependency cycles.
 * @param nodes Every node of the draft: its id and what it depends on.
 * @returns ok=false with one problem string per fault; ok=true when the DAG is sound.
 */
export function checkDag(nodes: Array<{ id: string; dependsOn: string[] }>): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const known = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    for (const dep of node.dependsOn) if (!known.has(dep)) problems.push(`${node.id}: unknown dependsOn target ${dep}`);
  }
  const state = new Map<string, number>();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const stack: string[] = [];
  const visit = (id: string): void => {
    const mark = state.get(id);
    if (mark === 0) { problems.push(`cycle: ${[...stack.slice(stack.indexOf(id)), id].join(' -> ')}`); return; }
    if (mark === 1) return;
    state.set(id, 0); stack.push(id);
    for (const dep of byId.get(id)?.dependsOn ?? []) visit(dep);
    stack.pop(); state.set(id, 1);
  };
  for (const node of nodes) visit(node.id);
  return { ok: problems.length === 0, problems };
}