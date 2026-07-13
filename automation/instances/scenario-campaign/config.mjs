/**
 * scenario-campaign — extend the live-prod scenarios (sdk/org/scenarios/*) with additional Acts,
 * run them end-to-end against production, fix any product bug found (with a test), and report.
 *
 * Round-robins the scenarios; each gets its OWN per-task round. Round 1 brings a scenario's runner
 * to a green baseline (scaffolding run.mjs from _template if missing) and adds a FIRST batch of new
 * Acts; round >= 2 adds ANOTHER batch, continuing from where prior rounds left off. The whole
 * PLAYBOOK + SCENARIO-FORMAT knowledge is embedded in the prompts (those two docs are being
 * deleted); the surviving references are the harness (sdk/org/scenarios/harness/), the _template,
 * and each scenario's own scenario.md.
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
  tasks: ['07-life-admin', '08-small-shop', '09-home-renovation', '10-family-recipes'],

  firstRoundTemplate: 'prompt.first.md',
  nextRoundTemplate: 'prompt.next.md',
  roundMode: (round) => (round <= 1 ? 'BASELINE + FIRST NEW ACTS' : `ADD ACTS (batch ${round})`),

  vars: (ctx) => ({
    SCENARIO_ID: ctx.task,
    SCENARIO_DIR: `sdk/org/scenarios/${ctx.task}`,
    SCENARIO_MD: `sdk/org/scenarios/${ctx.task}/scenario.md`,
    RUN_MJS: `sdk/org/scenarios/${ctx.task}/run.mjs`,
    RESULTS_DIR: `sdk/org/scenarios/${ctx.task}/results`,
  }),

  // The live run is stateful and sequential (one pod, one growing project) — keep it a single
  // coherent session. On expansion rounds, one READ-ONLY scout may prep the next batch in parallel;
  // it must never open a live THING session or send turns.
  subagents: (ctx) =>
    ctx.round <= 1
      ? []
      : [
          {
            name: 'catalog-scout',
            scope:
              'READ-ONLY prep: read {{SCENARIO_DIR}}/scenario.md + {{RUN_MJS}} + {{RESULTS_DIR}} and the ' +
              'feature catalog in this prompt; list which catalog capabilities {{SCENARIO_ID}} does NOT yet ' +
              'cover, and propose the next 2–4 Acts (name + what each asserts on the trace/real state). ' +
              'Do NOT provision, open a THING session, or send any turn — analysis only.',
          },
        ],

  claude: {
    // Add backup accounts to keep running across a usage-limit reset, e.g.:
    // bins: ['claude', 'claude-work', 'claude-personal'],
    bins: ['claude'],
    // cwd is the monorepo ROOT — the session already has the WHOLE lmthing monorepo (the parent
    // repo AND the sdk/org submodule) in scope, which it needs to build, commit + push BOTH repos
    // to trigger CI, and verify the deploy. No extra --add-dir scoping.
    addDirs: [],
    flags: ['--verbose'],
  },

  prePull: true,
  interval: 10800, // 3h — live runs are long
  startDelay: 0,
};
