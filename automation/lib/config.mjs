/**
 * config.mjs — resolve an instance, load + validate its config.mjs, and derive the run context.
 *
 * An instance is a directory `automation/instances/<name>/`. Its `config.mjs` default-exports a
 * plain object (see automation/README.md for the full schema). This module fills defaults, honors
 * env overrides, re-resolves the (possibly dynamic) task list, does the fewest-completed-runs
 * selection that gives every task its OWN round, and builds the `ctx` passed to the templates.
 *
 * Zero dependencies — Node built-ins only.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { taskRound } from './state.mjs';

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
export const AUTOMATION_ROOT = resolve(LIB_DIR, '..');
export const REPO_ROOT = resolve(AUTOMATION_ROOT, '..');
export const INSTANCES_DIR = join(AUTOMATION_ROOT, 'instances');

/** All resolved filesystem paths for an instance. */
export function instancePaths(name) {
  const dir = join(INSTANCES_DIR, name);
  const stateDir = join(dir, 'state');
  return {
    name,
    dir,
    configFile: join(dir, 'config.mjs'),
    stateJson: join(dir, 'state.json'),
    stateDir,
    runtime: join(stateDir, 'runtime.json'),
    control: join(stateDir, 'control'),
    loopLog: join(stateDir, 'loop.log'),
    roundsDir: join(dir, 'rounds'),
    runDir: (round, task) => join(dir, 'rounds', String(round), task),
    progressFile: (round, task) => join(dir, 'rounds', String(round), task, 'PROGRESS.md'),
    attemptDir: (round, task, n) => join(dir, 'rounds', String(round), task, `attempt-${n}`),
  };
}

/** List instance names (directories under instances/, excluding scaffolds prefixed with `_`). */
export function listInstances() {
  if (!existsSync(INSTANCES_DIR)) return [];
  return readdirSync(INSTANCES_DIR)
    .filter((n) => !n.startsWith('_') && !n.startsWith('.'))
    .filter((n) => {
      try {
        return statSync(join(INSTANCES_DIR, n)).isDirectory() && existsSync(join(INSTANCES_DIR, n, 'config.mjs'));
      } catch {
        return false;
      }
    })
    .sort();
}

function fail(msg) {
  throw new Error(`[automation config] ${msg}`);
}

/** Split a comma/space separated env list into a clean array. */
function splitList(v) {
  return String(v)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Load + normalize an instance config. Returns a config object with every field filled and env
 * overrides applied. Does NOT resolve tasks yet (that happens per-selection, so late additions
 * are picked up).
 */
export async function loadConfig(name) {
  const paths = instancePaths(name);
  if (!existsSync(paths.dir)) fail(`no instance "${name}" — expected a directory at ${paths.dir}`);
  if (!existsSync(paths.configFile)) fail(`instance "${name}" has no config.mjs at ${paths.configFile}`);

  const mod = await import(pathToFileURL(paths.configFile).href);
  const raw = mod.default ?? mod.config ?? mod;
  if (!raw || typeof raw !== 'object') fail(`config.mjs for "${name}" must default-export an object`);
  if (!('tasks' in raw)) fail(`config.mjs for "${name}" must define \`tasks\``);

  const claude = raw.claude ?? {};
  const bins = process.env.CLAUDE_BINS
    ? splitList(process.env.CLAUDE_BINS)
    : process.env.CLAUDE_BIN
      ? [process.env.CLAUDE_BIN]
      : Array.isArray(claude.bins) && claude.bins.length
        ? claude.bins
        : ['claude'];

  const cfg = {
    name: raw.name ?? name,
    cwd: raw.cwd ?? REPO_ROOT,
    _tasks: raw.tasks,
    firstRoundTemplate: raw.firstRoundTemplate ?? 'prompt.first.md',
    nextRoundTemplate: raw.nextRoundTemplate ?? 'prompt.next.md',
    continueTemplate: raw.continueTemplate ?? null,
    roundMode: typeof raw.roundMode === 'function' ? raw.roundMode : (r) => (r <= 1 ? 'CORE BUILD' : `ROUND ${r}`),
    vars: typeof raw.vars === 'function' ? raw.vars : () => ({}),
    subagents: typeof raw.subagents === 'function' ? raw.subagents : () => [],
    claude: {
      bins,
      addDirs: Array.isArray(claude.addDirs) ? claude.addDirs : [],
      flags: Array.isArray(claude.flags) ? claude.flags : [],
      model: process.env.CLAUDE_MODEL ?? claude.model ?? null,
      // Extra env vars merged into every spawned claude session (over `process.env`). Lets an
      // instance pin config its agents+subprocesses must see even after a bare cron/watchdog restart.
      env: claude.env && typeof claude.env === 'object' ? claude.env : {},
    },
    prePull: raw.prePull ?? false,
    interval: process.env.RUN_INTERVAL ? Number(process.env.RUN_INTERVAL) : (raw.interval ?? 18000),
    startDelay: process.env.START_DELAY ? Number(process.env.START_DELAY) : (raw.startDelay ?? 0),
    // How many tasks may run CONCURRENTLY (one claude session each). 1 = the sequential default.
    // Never more than one session per task: a task already running is excluded from selection.
    maxParallel: Math.max(
      1,
      Math.trunc(process.env.MAX_PARALLEL ? Number(process.env.MAX_PARALLEL) : (raw.maxParallel ?? 1)) || 1,
    ),
    paths,
  };
  return cfg;
}

/** Resolve the (possibly function-valued) task list fresh, so appended items are seen. */
export function resolveTasks(cfg) {
  const t = typeof cfg._tasks === 'function' ? cfg._tasks() : cfg._tasks;
  if (!Array.isArray(t) || t.length === 0) fail(`\`tasks\` for "${cfg.name}" resolved to an empty list`);
  const tasks = t.map(String);
  if (new Set(tasks).size !== tasks.length) fail(`\`tasks\` for "${cfg.name}" has duplicate ids`);
  return tasks;
}

/**
 * Pick the next task: the one with the FEWEST completed runs (ties → earliest in list order).
 * This round-robins an even list and auto-prioritizes a newly-appended task (count 0), which then
 * runs its own round 1. `forced` overrides selection but must be a member of the list.
 *
 * `busy` holds the tasks currently occupying a parallel slot; they are excluded so a task never runs
 * twice at once (its round would be ambiguous and its two sessions would fight over the same files).
 * Returns null when every task is busy — the caller leaves the free slot idle until one frees up.
 */
export function selectTask(cfg, state, forced = null, busy = new Set()) {
  const tasks = resolveTasks(cfg);
  const free = tasks.filter((t) => !busy.has(t));
  let task;
  if (forced != null) {
    if (!tasks.includes(forced)) fail(`forced task "${forced}" is not in the task list [${tasks.join(', ')}]`);
    if (busy.has(forced)) return null;
    task = forced;
  } else {
    if (free.length === 0) return null;
    task = free.reduce((best, t) => (taskRound(state, t) < taskRound(state, best) ? t : best), free[0]);
  }
  const round = taskRound(state, task) + 1;
  return { task, round, taskIndex: tasks.indexOf(task) + 1, taskCount: tasks.length, tasks, forced: forced != null };
}

/** Build the template/render context for a selected task. */
export function buildCtx(cfg, sel, branch) {
  const base = {
    task: sel.task,
    round: sel.round,
    taskIndex: sel.taskIndex,
    taskCount: sel.taskCount,
    branch: branch ?? '',
    instanceDir: cfg.paths.dir,
    repoRoot: REPO_ROOT,
  };
  base.roundMode = String(cfg.roundMode(sel.round));
  return base;
}
