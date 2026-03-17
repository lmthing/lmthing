/**
 * Example 11: Default export setup function
 *
 * Demonstrates how a default export runs before the agent starts.
 * The setup function's body is executed in the REPL context — the agent
 * sees the declared tasklists and variables as if it wrote them itself.
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/11-setup.ts -m openai:gpt-4o-mini
 *   npx tsx src/cli/bin.ts examples/11-setup.ts -m anthropic:claude-sonnet-4-20250514
 */

// ── Functions the agent can call ──

const items: Array<{ name: string; quantity: number }> = [];

export function addItem(name: string, quantity: number): { name: string; quantity: number } {
  const item = { name, quantity };
  items.push(item);
  return item;
}

export function listItems(): Array<{ name: string; quantity: number }> {
  return [...items];
}

export function totalItems(): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

// ── Default export: setup code that runs before the agent ──

export default function ({ tasklist }: { tasklist: Function }) {
  tasklist("inventory", "Build a small inventory", [
    {
      id: "add_items",
      instructions: "Add 3 items to the inventory",
      outputSchema: { count: { type: "number" } },
    },
    {
      id: "summarize",
      instructions: "Show the total count",
      outputSchema: { total: { type: "number" } },
    },
  ]);
}

// ── CLI config ──

export const replConfig = {
  keepHistory: true,
  instruct: `You are an inventory assistant. A tasklist has already been set up for you — follow it. Add 3 items (e.g. apples, bananas, oranges) with varying quantities, then summarize.`,
};
