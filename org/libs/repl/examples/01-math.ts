/**
 * Example 1: Math helper
 *
 * The agent gets basic math functions and is asked to solve a problem.
 * Demonstrates: stop() for reading values, multiple turns, function calls.
 *
 * Run:
 *   OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_MODEL=qwen2.5-coder npx tsx examples/01-math.ts
 *   OPENAI_API_KEY=sk-... npx tsx examples/01-math.ts
 *   OPENAI_BASE_URL=http://localhost:1234/v1 OPENAI_MODEL=local-model npx tsx examples/01-math.ts
 */

import { runRepl } from './runner'

// ── Functions the agent can call ──

function add(a: number, b: number): number {
  return a + b
}

function multiply(a: number, b: number): number {
  return a * b
}

function power(base: number, exp: number): number {
  return Math.pow(base, exp)
}

function sqrt(n: number): number {
  return Math.sqrt(n)
}

function factorial(n: number): number {
  if (n <= 1) return 1
  let result = 1
  for (let i = 2; i <= n; i++) result *= i
  return result
}

function fibonacci(n: number): number[] {
  const fib = [0, 1]
  for (let i = 2; i < n; i++) fib.push(fib[i - 1] + fib[i - 2])
  return fib.slice(0, n)
}

// ── Run ──

await runRepl({
  userMessage: 'Calculate the first 10 Fibonacci numbers, then find the sum of all even ones. Also compute 7! (factorial of 7).',
  globals: { add, multiply, power, sqrt, factorial, fibonacci },
  functionSignatures: `
  add(a: number, b: number): number — Add two numbers
  multiply(a: number, b: number): number — Multiply two numbers
  power(base: number, exp: number): number — Raise base to exponent
  sqrt(n: number): number — Square root
  factorial(n: number): number — Factorial of n
  fibonacci(n: number): number[] — First n Fibonacci numbers
  `,
})
