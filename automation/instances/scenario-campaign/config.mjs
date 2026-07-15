/**
 * scenario-campaign — run each scenario (sdk/org/scenarios/<id>/scenario.yaml) end-to-end against a
 * LOCAL `lmthing serve` (localhost:8080, budget-free Azure keys from sdk/org/.env), JUDGE every step
 * on the trace + real state, and on the FIRST failure fix it at the right rung (L0 scenario / L1
 * prompt / L2 structure / L3 framework), then PROVE the fix with a fresh rerun. One failure per
 * invocation. If a scenario is fully green, the judge authors ONE extension and stops.
 *
 * The judge NEVER commits — it leaves its changes uncommitted with a full report; a HUMAN reviews the
 * diff against the report and commits directly to `main`. Because a human gates every commit, this
 * instance runs SERIALLY (maxParallel 1) and is meant to be driven one scenario at a time via
 * `node automation/lmauto.mjs run scenario-campaign` (runs one task, returns) — review + commit,
 * then run the next. The prompts embed the whole spec: scenario-spec.md (shared) + judge.md (the
 * run/judge/fix/verify/report loop) + create.md / extend.md (authoring). The engine's own ledger
 * commit only touches automation artifacts, never the product diff under review.
 *
 * PREREQUISITES before a scenario is runnable here: (1) a generic YAML runner in the harness that
 * plays scenario.yaml steps and exposes the trace to the judge; (2) the scenario's scenario.yaml
 * authored (via create.md) — the old scenario.md + run.mjs pairs predate this model.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..'); // instances/scenario-campaign → automation → repo root

export default {
  name: 'scenario-campaign',
  cwd: REPO_ROOT,

  // Each task is a scenario id under sdk/org/scenarios/. Round 1 baselines + adds the first new
  // Acts; later rounds add more. Append new scenario ids here to fold them in (they start at round 1).
  tasks: [
    '05-latam',
    '06-tanzania',
    '07-life-admin',
    '08-small-shop',
    '09-home-renovation',
    '10-family-recipes',
  ],

  // Every round runs the judge; it decides internally whether to FIX the first failure (and verify)
  // or, if the scenario is fully green, author ONE extension. (create.md is a separate manual
  // entrypoint for authoring a brand-new scenario.yaml — not part of the round loop.)
  firstRoundTemplate: 'judge.md',
  nextRoundTemplate: 'judge.md',
  // Resume wrapper honoring the never-commit rule (the built-in one says "commit early & often").
  continueTemplate: 'prompt.continue.md',
  roundMode: (round) => `judge pass ${round} — fix one failure & verify, or extend if green`,

  // A scenario is now a single declarative sdk/org/scenarios/<id>/scenario.yaml (+ fixtures/) played
  // by the generic YAML runner — no per-scenario run.mjs, no results/ dir. The judge's report goes
  // beside its progress log in the engine's round-artifact tree ({{progressFile}}'s dir), which the
  // engine commits with the ledger.
  vars: (ctx) => ({
    SCENARIO_ID: ctx.task,
    SCENARIO_DIR: `sdk/org/scenarios/${ctx.task}`,
    SCENARIO_YAML: `sdk/org/scenarios/${ctx.task}/scenario.yaml`,
  }),

  // The judge is ONE coherent session: it drives the live run, plays the persona, judges, and fixes.
  // No parallel subagents — its work is sequential and its context must stay clean (the whole point
  // of one-failure-per-invocation is to bound context rot).
  subagents: (ctx) => [],

  claude: {
    // Add backup accounts to keep running across a usage-limit reset, e.g.:
    // bins: ['claude', 'claude-work', 'claude-personal'],
    // `claude-az` is a shell ALIAS (`alias claude-az=...`), not a binary on PATH — child_process.spawn
    // can't resolve aliases (no shell involved), so it must be the script's absolute path here.
    bins: ['/home/vasilis/.claude-azure/launch.sh'],
    // cwd is the monorepo ROOT — the session has the WHOLE lmthing monorepo (parent repo AND the
    // sdk/org submodule) in scope, which it needs to edit product source, `pnpm build`, restart the
    // local server, and commit both repos. No extra --add-dir scoping.
    addDirs: [],
    flags: ['--verbose'],
    model: 'claude-sonnet-5',
    // Pin the LOCAL target into every spawned agent (and its harness subprocesses) — carried in
    // committed config so it survives a bare cron/watchdog restart that has no ambient env.
    env: { SCENARIO_TARGET: 'local' },
  },

  prePull: true,
  interval: 600, // 10m — a lane cools down this long after ITS run before taking the next scenario
  //                 (long enough for the last run's CI/deploy to land, short enough to keep rounds moving)
  startDelay: 0,

  // SERIAL. A human reviews and commits each judge run's diff before the next, so there must only
  // ever be ONE scenario's uncommitted changes in the shared working tree at a time — parallel lanes
  // would tangle their diffs into one unreviewable blob.
  maxParallel: 1,
};
