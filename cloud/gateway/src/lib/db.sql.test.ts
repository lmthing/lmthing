import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The gateway's route tests mock `db.js` wholesale, so no unit test ever sends
 * these statements to a server — a query can be syntactically fine TypeScript
 * and still be rejected by Postgres every single time it runs.
 *
 * That is how the last-editor guard shipped broken: it locked its rows with
 *
 *   SELECT count(*) AS count FROM team_members … FOR UPDATE
 *
 * which Postgres refuses outright ("FOR UPDATE is not allowed with aggregate
 * functions"). Demoting or removing a member 500'd, and the guard that was
 * supposed to protect a team's last editor never once ran.
 *
 * Lock the ROWS and count them in JS instead.
 */

const source = readFileSync(fileURLToPath(new URL("./db.ts", import.meta.url)), "utf8");

/**
 * Every tagged SQL template literal in the file, flattened to one line. Scoping
 * to a single backtick pair matters: one statement's `SELECT` must not be able
 * to pair with a `FOR UPDATE` belonging to a query further down the file.
 */
function sqlStatements(): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/`([^`]*)`/g)) {
    const text = m[1]!.replace(/\s+/g, " ").trim();
    if (/^(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(text)) out.push(text);
  }
  return out;
}

/** Just the ones that take row locks. */
function lockingSelects(): string[] {
  return sqlStatements().filter((q) => /FOR UPDATE/i.test(q));
}

const AGGREGATES = /\b(count|sum|avg|min|max|array_agg|string_agg|json_agg)\s*\(/i;

describe("row-locking queries", () => {
  it("has some, so this guard is actually looking at something", () => {
    expect(lockingSelects().length).toBeGreaterThan(0);
  });

  it("never combines an aggregate with FOR UPDATE — Postgres rejects it", () => {
    const offenders = lockingSelects().filter((q) => AGGREGATES.test(q));
    expect(offenders).toEqual([]);
  });
});
