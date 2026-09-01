import type { Problem, TasklistDag } from './types.ts';

/** Validate only topology; this standalone package never executes tasklist nodes. */
export function validateDag(dag: TasklistDag): Problem[] {
  const problems: Problem[] = [];
  const ids = new Set<string>();
  for (const node of dag.nodes) {
    if (ids.has(node.id)) problems.push({ path: node.file, message: `duplicate node id: ${node.id}` });
    ids.add(node.id);
  }
  for (const node of dag.nodes) {
    for (const dependency of node.dependsOn) {
      if (!ids.has(dependency)) problems.push({ path: node.file, message: `unknown dependsOn target: ${dependency}` });
    }
  }

  const byId = new Map(dag.nodes.map((node) => [node.id, node]));
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const reportedCycles = new Set<string>();
  const visit = (id: string): void => {
    const node = byId.get(id);
    if (!node) return;
    if (state.get(id) === 'visiting') {
      const cycle = [...stack.slice(stack.indexOf(id)), id];
      const key = cycle.join('\u0000');
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key);
        problems.push({ path: node.file, message: `cycle: ${cycle.join(' -> ')}` });
      }
      return;
    }
    if (state.get(id) === 'done') return;
    state.set(id, 'visiting'); stack.push(id);
    for (const dependency of node.dependsOn) visit(dependency);
    stack.pop(); state.set(id, 'done');
  };
  for (const node of dag.nodes) visit(node.id);

  // A node with no route from any root is necessarily cyclic; report it separately so
  // callers can identify every stranded node even when the cycle is elsewhere.
  const roots = dag.nodes.filter((node) => node.dependsOn.length === 0).map((node) => node.id);
  const reachable = new Set<string>(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of dag.nodes) {
      if (!reachable.has(node.id) && node.dependsOn.some((dependency) => reachable.has(dependency))) {
        reachable.add(node.id); changed = true;
      }
    }
  }
  for (const node of dag.nodes) {
    if (!reachable.has(node.id)) problems.push({ path: node.file, message: `unreachable node: ${node.id}` });
  }
  return problems;
}

/** Nodes whose dependencies have all been completed, in their source-file order. */
export function readyNodes(dag: TasklistDag, completed: readonly string[]): string[] {
  const done = new Set(completed);
  return dag.nodes.filter((node) => !done.has(node.id) && node.dependsOn.every((dependency) => done.has(dependency))).map((node) => node.id);
}

/** A stable Kahn ordering. A cycle is returned as a Problem instead of an arbitrary partial order. */
export function topoOrder(dag: TasklistDag): string[] | Problem {
  const known = new Set(dag.nodes.map((node) => node.id));
  const unknown = dag.nodes.flatMap((node) => node.dependsOn.filter((dependency) => !known.has(dependency)));
  if (unknown.length) return { path: '', message: `unknown dependsOn target: ${unknown[0]}` };
  const indegree = new Map(dag.nodes.map((node) => [node.id, node.dependsOn.length]));
  const queue = dag.nodes.filter((node) => node.dependsOn.length === 0).map((node) => node.id);
  const output: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    output.push(id);
    for (const node of dag.nodes) {
      if (!node.dependsOn.includes(id)) continue;
      const remaining = indegree.get(node.id)! - 1;
      indegree.set(node.id, remaining);
      if (remaining === 0) queue.push(node.id);
    }
  }
  if (output.length !== dag.nodes.length) {
    const cycle = validateDag(dag).find((problem) => problem.message.startsWith('cycle:'));
    return cycle ?? { path: '', message: 'cycle in tasklist DAG' };
  }
  return output;
}
