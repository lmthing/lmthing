/**
 * Example 10: Gradual function discovery with loadClass
 *
 * The agent sees only class names and descriptions initially.
 * It calls `await loadClass("ClassName")` to expand methods on demand.
 * Demonstrates: lazy-loading of class methods, namespaced access.
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/10-load-class.ts -m openai:gpt-4o-mini
 */

// ── Data processing class ──

interface DataRow {
  name: string
  value: number
  category: string
}

const SAMPLE_DATA: DataRow[] = [
  { name: "Alpha", value: 42, category: "A" },
  { name: "Beta", value: 17, category: "B" },
  { name: "Gamma", value: 88, category: "A" },
  { name: "Delta", value: 31, category: "C" },
  { name: "Epsilon", value: 55, category: "B" },
  { name: "Zeta", value: 73, category: "A" },
  { name: "Eta", value: 29, category: "C" },
  { name: "Theta", value: 64, category: "B" },
]

/** Processes and transforms structured data rows. */
export class DataProcessor {
  private data: DataRow[] = [...SAMPLE_DATA]

  /** Load the built-in sample dataset and return all rows. */
  load(): DataRow[] {
    return [...this.data]
  }

  /** Filter rows where the given field matches the value. */
  filter(field: keyof DataRow, value: unknown): DataRow[] {
    return this.data.filter(r => r[field] === value)
  }

  /** Sort rows by a numeric or string field. */
  sort(field: keyof DataRow, order: "asc" | "desc" = "asc"): DataRow[] {
    return [...this.data].sort((a, b) => {
      const va = a[field], vb = b[field]
      if (typeof va === "number" && typeof vb === "number") return order === "asc" ? va - vb : vb - va
      return order === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
    })
  }

  /** Compute the sum, mean, min, and max of a numeric field. */
  stats(field: "value"): { sum: number; mean: number; min: number; max: number } {
    const values = this.data.map(r => r[field])
    return {
      sum: values.reduce((a, b) => a + b, 0),
      mean: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      min: Math.min(...values),
      max: Math.max(...values),
    }
  }

  /** Group rows by a field and return counts per group. */
  groupCounts(field: keyof DataRow): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const r of this.data) {
      const key = String(r[field])
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }
}

// ── Text utilities class ──

/** String manipulation utilities for formatting and analysis. */
export class TextUtils {
  /** Reverse a string. */
  reverse(s: string): string {
    return s.split("").reverse().join("")
  }

  /** Count word occurrences in a text. */
  wordCount(text: string): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const word of text.toLowerCase().split(/\s+/)) {
      if (word) counts[word] = (counts[word] ?? 0) + 1
    }
    return counts
  }

  /** Truncate text to a maximum length with an ellipsis. */
  truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength - 1) + "…"
  }

  /** Convert a string to title case. */
  titleCase(s: string): string {
    return s.replace(/\b\w/g, c => c.toUpperCase())
  }
}

// ── CLI config ──

export const replConfig = {
  maxTurns: 15,
  debugFile: "./debug-run.xml",
  instruct: "You have two classes available: DataProcessor and TextUtils. Use loadClass() to discover their methods before using them. Start by exploring what each class offers.",
}
