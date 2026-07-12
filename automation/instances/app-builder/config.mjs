/**
 * app-builder — the first lmauto instance (formerly the bespoke automation/run.sh).
 *
 * Round-robins the five store project-applications; each gets its own per-task round. Round 1 is a
 * CORE BUILD (single session); round >= 2 is a FEATURE EXPANSION fanned across subagents. The app
 * under test is exercised with the LIVE model from sdk/org/.env (see vars()).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..'); // instances/app-builder → automation → repo root
const ENV_FILE = join(REPO_ROOT, 'sdk/org/.env');

// app → spec file + project-scoped space name (as in the original run.sh maps).
const SPEC = {
  blog: 'blog-application.md',
  kitchen: 'kitchen-application.md',
  health: 'health-application.md',
  trips: 'trips-application.md',
  homes: 'homes-application.md',
};
const SPACE = {
  blog: 'newsroom',
  kitchen: 'chef',
  health: 'clinic',
  trips: 'concierge',
  homes: 'scout',
};

/** Pick the LIVE test model out of sdk/org/.env (LM_MODEL alias → LM_MODEL_<alias>). */
function pickModel() {
  let env = '';
  try {
    env = readFileSync(ENV_FILE, 'utf8');
  } catch {
    return { alias: 'S', model: 'unknown' };
  }
  const get = (re) => env.match(re)?.[1]?.trim() ?? '';
  const alias = get(/^LM_MODEL=(.*)$/m) || 'S';
  const model = get(new RegExp(`^LM_MODEL_${alias}=(.*)$`, 'm')) || get(/^LM_MODEL_S=(.*)$/m) || 'unknown';
  return { alias, model };
}

export default {
  name: 'app-builder',
  cwd: REPO_ROOT,
  tasks: ['blog', 'kitchen', 'health', 'trips', 'homes'],

  firstRoundTemplate: 'prompt.first.md',
  nextRoundTemplate: 'prompt.next.md',
  roundMode: (round) => (round <= 1 ? 'CORE BUILD' : 'FEATURE EXPANSION'),

  vars: (ctx) => {
    const { alias, model } = pickModel();
    return {
      SPEC_FILE: SPEC[ctx.task] ?? `${ctx.task}-application.md`,
      SPACE: SPACE[ctx.task] ?? ctx.task,
      MODEL_ALIAS: alias,
      MODEL: model,
    };
  },

  // Round 1 builds the core in one focused session; expansion rounds fan out by concern.
  subagents: (ctx) =>
    ctx.round <= 1
      ? []
      : [
          {
            name: 'spaces-builder',
            scope:
              'Author ≥1 NEW full-format project space AND remediate existing spaces for {{task}} ' +
              '(agents with charter.md+instruct.md, tasklists/, functions/, components/, extensive ' +
              'knowledge/) under store/projects/{{task}}/spaces/. End with ≥2 project-scoped spaces.',
          },
          {
            name: 'data-api-hooks-builder',
            scope:
              'Add ≥3 new database tables (+ columns/relations, all with required descriptions), ' +
              '≥8 new typed API endpoints, and ≥3 new hooks (cron/database) for {{task}}.',
          },
          {
            name: 'pages-builder',
            scope:
              'Build ≥5 new pages + components (DESIGN TOKENS ONLY) with richer UX for {{task}}, ' +
              'wired to the new and existing APIs.',
          },
          {
            name: 'test-and-verify',
            scope:
              'Add schema/api/hook tests + at least one end-to-end LIVE-model test for {{task}}, run ' +
              'them green, and keep pnpm lint:tokens / typecheck / build green across everything touched.',
          },
        ],

  claude: {
    bins: ['claude'], // add backup accounts here, e.g. ['claude','claude-work','claude-personal']
    addDirs: ['sdk/org'],
    flags: ['--verbose'],
  },

  prePull: true,
  interval: 18000, // 5h
  startDelay: 0,
};
