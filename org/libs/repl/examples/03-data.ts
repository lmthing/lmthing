/**
 * Example 3: Data analysis
 *
 * The agent gets data manipulation functions and analyzes a dataset.
 * Demonstrates: working with arrays/objects, multi-step analysis, stop() for inspection.
 *
 * Run:
 *   npx tsx examples/03-data.ts openai:gpt-4o-mini
 *   npx tsx examples/03-data.ts zai:glm-4.5
 */

import { runRepl } from "./runner";

const model = process.argv[2];
if (!model) {
  console.error("Usage: npx tsx examples/03-data.ts <provider:model>");
  process.exit(1);
}

// ── Sample dataset ──

interface Employee {
  id: number;
  name: string;
  department: string;
  salary: number;
  startYear: number;
  skills: string[];
}

const EMPLOYEES: Employee[] = [
  {
    id: 1,
    name: "Alice Chen",
    department: "Engineering",
    salary: 125000,
    startYear: 2019,
    skills: ["TypeScript", "React", "Node.js"],
  },
  {
    id: 2,
    name: "Bob Martinez",
    department: "Engineering",
    salary: 115000,
    startYear: 2020,
    skills: ["Python", "Django", "PostgreSQL"],
  },
  {
    id: 3,
    name: "Carol Williams",
    department: "Design",
    salary: 105000,
    startYear: 2021,
    skills: ["Figma", "CSS", "React"],
  },
  {
    id: 4,
    name: "David Kim",
    department: "Engineering",
    salary: 140000,
    startYear: 2018,
    skills: ["Go", "Kubernetes", "AWS"],
  },
  {
    id: 5,
    name: "Eva Novak",
    department: "Marketing",
    salary: 95000,
    startYear: 2022,
    skills: ["SEO", "Analytics", "Content"],
  },
  {
    id: 6,
    name: "Frank Park",
    department: "Engineering",
    salary: 130000,
    startYear: 2019,
    skills: ["Rust", "C++", "Linux"],
  },
  {
    id: 7,
    name: "Grace Liu",
    department: "Design",
    salary: 110000,
    startYear: 2020,
    skills: ["Figma", "Illustration", "Motion"],
  },
  {
    id: 8,
    name: "Hiro Tanaka",
    department: "Engineering",
    salary: 145000,
    startYear: 2017,
    skills: ["TypeScript", "AWS", "Terraform"],
  },
  {
    id: 9,
    name: "Iris Johnson",
    department: "Marketing",
    salary: 90000,
    startYear: 2023,
    skills: ["Social Media", "Content", "Analytics"],
  },
  {
    id: 10,
    name: "Jack Brown",
    department: "Design",
    salary: 100000,
    startYear: 2022,
    skills: ["UX Research", "Figma", "Prototyping"],
  },
];

// ── Functions the agent can call ──

function getEmployees(): Employee[] {
  return [...EMPLOYEES];
}

function filterBy(employees: Employee[], field: string, value: unknown): Employee[] {
  return employees.filter((e) => (e as any)[field] === value);
}

function sortBy(employees: Employee[], field: string, order: "asc" | "desc" = "asc"): Employee[] {
  const sorted = [...employees].sort((a, b) => {
    const va = (a as any)[field];
    const vb = (b as any)[field];
    if (typeof va === "number") return order === "asc" ? va - vb : vb - va;
    return order === "asc"
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });
  return sorted;
}

function average(employees: Employee[], field: string): number {
  const values = employees.map((e) => (e as any)[field] as number);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function groupBy(employees: Employee[], field: string): Record<string, Employee[]> {
  const groups: Record<string, Employee[]> = {};
  for (const e of employees) {
    const key = String((e as any)[field]);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return groups;
}

function countByField(employees: Employee[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of employees) {
    const key = String((e as any)[field]);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function findSkill(employees: Employee[], skill: string): Employee[] {
  return employees.filter((e) =>
    e.skills.some((s) => s.toLowerCase().includes(skill.toLowerCase())),
  );
}

function topN(employees: Employee[], field: string, n: number): Employee[] {
  return sortBy(employees, field, "desc").slice(0, n);
}

// ── Run ──

await runRepl({
  model,
  userMessage:
    "Analyze the employee dataset. I want to know: (1) How many employees per department? (2) What is the average salary by department? (3) Who are the top 3 highest paid? (4) Which employees know TypeScript?",
  globals: { getEmployees, filterBy, sortBy, average, groupBy, countByField, findSkill, topN },
  functionSignatures: `
  getEmployees(): Employee[] — Get all employees. Employee has: id, name, department, salary, startYear, skills[]
  filterBy(employees: Employee[], field: string, value: any): Employee[] — Filter by field value
  sortBy(employees: Employee[], field: string, order?: 'asc' | 'desc'): Employee[] — Sort by field
  average(employees: Employee[], field: string): number — Average of a numeric field
  groupBy(employees: Employee[], field: string): Record<string, Employee[]> — Group by field
  countByField(employees: Employee[], field: string): Record<string, number> — Count per field value
  findSkill(employees: Employee[], skill: string): Employee[] — Find employees with a skill
  topN(employees: Employee[], field: string, n: number): Employee[] — Top N by field (descending)
  `,
  maxTurns: 15,
  maxCheckpointReminders: 6,
  debugFile: "./debug-run.xml",
  instruct:
    "Work through each question one at a time. Use stop() after each computation to inspect the result before moving to the next question.",
});
