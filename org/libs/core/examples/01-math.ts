/**
 * Example 1: Math helper
 *
 * The agent gets basic math functions and is asked to solve a problem.
 * Demonstrates: stop() for reading values, multiple turns, function calls.
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/01-math.ts -m openai:gpt-4o-mini
 *   npx tsx src/cli/bin.ts examples/01-math.ts -m zai:glm-4.5
 *   npx tsx src/cli/bin.ts examples/01-math.ts -m anthropic:claude-sonnet-4-20250514
 */

// ── Functions the agent can call ──

export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function power(base: number, exp: number): number {
  return Math.pow(base, exp);
}

export function sqrt(n: number): number {
  return Math.sqrt(n);
}

export function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

export function fibonacci(n: number): number[] {
  const fib = [0, 1];
  for (let i = 2; i < n; i++) fib.push(fib[i - 1] + fib[i - 2]);
  return fib.slice(0, n);
}

// ── CLI config ──

export const replConfig = {
  functionSignatures: `
  add(a: number, b: number): number — Add two numbers
  multiply(a: number, b: number): number — Multiply two numbers
  power(base: number, exp: number): number — Raise base to exponent
  sqrt(n: number): number — Square root
  factorial(n: number): number — Factorial of n
  fibonacci(n: number): number[] — First n Fibonacci numbers
  `,
  debugFile: "./debug-run.json",
};
