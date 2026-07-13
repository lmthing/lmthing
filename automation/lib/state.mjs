/**
 * state.mjs — persistence for an automation instance.
 *
 * Two kinds of state, deliberately separated:
 *   • state.json  — the DURABLE, git-COMMITTED ledger (per-task rounds + run/result history).
 *   • state/runtime.json + state/control + state/loop.log — EPHEMERAL live process state,
 *     gitignored (they churn every tick).
 *
 * This module owns atomic JSON writes for both, the control-file channel, and the git-commit
 * helper that programmatically records state.json (+ the just-finished run's artifacts) on the
 * branch the run started on.
 *
 * Zero dependencies — Node built-ins only.
 */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { dirname } from 'node:path';

// --- atomic JSON I/O -------------------------------------------------------

/** Read JSON, returning `fallback` if the file is missing or unparseable. */
export function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Write JSON atomically (temp file + rename) so a reader never sees a half-written file. */
export function writeJsonAtomic(file, obj) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
}

// --- the durable ledger (state.json) --------------------------------------

/** The empty ledger shape. */
export function emptyState() {
  return { tasks: {}, runs: [], updatedAt: null };
}

/** Load the ledger, or a fresh empty one. */
export function loadState(stateJsonPath) {
  const s = readJson(stateJsonPath, null);
  if (!s || typeof s !== 'object') return emptyState();
  s.tasks ??= {};
  s.runs ??= [];
  return s;
}

/** Persist the ledger (stamps updatedAt). */
export function saveState(stateJsonPath, state) {
  state.updatedAt = new Date().toISOString();
  writeJsonAtomic(stateJsonPath, state);
}

/** Completed-run count for a task (0 if never run). */
export function taskRound(state, task) {
  return state.tasks[task]?.round ?? 0;
}

/** Increment a task's completed-run count. */
export function bumpTaskRound(state, task) {
  state.tasks[task] ??= { round: 0 };
  state.tasks[task].round += 1;
  return state.tasks[task].round;
}

// --- ephemeral live state (runtime.json) ----------------------------------

export function writeRuntime(runtimePath, obj) {
  obj.updatedAt = new Date().toISOString();
  writeJsonAtomic(runtimePath, obj);
}

export function readRuntime(runtimePath, fallback = null) {
  return readJson(runtimePath, fallback);
}

// --- control channel (pause|continue|skip|stop) ---------------------------

/** Write a control command for a running loop to pick up. */
export function writeControl(controlPath, cmd) {
  mkdirSync(dirname(controlPath), { recursive: true });
  writeFileSync(controlPath, `${cmd}\n`, 'utf8');
}

/** Read-and-clear the pending control command (returns null if none). */
export function takeControl(controlPath) {
  if (!existsSync(controlPath)) return null;
  let cmd = null;
  try {
    cmd = readFileSync(controlPath, 'utf8').trim() || null;
  } catch {
    cmd = null;
  }
  try {
    rmSync(controlPath, { force: true });
  } catch {
    /* ignore */
  }
  return cmd;
}

// --- git-commit helper -----------------------------------------------------

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { code: r.status ?? 1, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

/**
 * `git` that retries while the index is locked. Parallel runs (and the agents themselves) commit to
 * the same working tree, so `index.lock` contention is expected and transient — not a real failure.
 * Synchronous by design: spawnSync + a busy-wait keeps the whole read-modify-write of the ledger
 * uninterruptible on the single JS thread, which is what makes concurrent slots safe without a lock.
 */
function gitLocking(cwd, args, { tries = 6, waitMs = 500 } = {}) {
  let r;
  for (let i = 0; i < tries; i++) {
    r = git(cwd, args);
    if (r.code === 0 || !/index\.lock|Unable to create .*\.lock/i.test(r.stderr)) return r;
    const until = Date.now() + waitMs;
    while (Date.now() < until) {
      /* busy-wait: we must not yield the thread mid-ledger-update */
    }
  }
  return r;
}

/** The branch currently checked out in `cwd` (or null outside a repo). */
export function currentBranch(cwd) {
  const r = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return r.code === 0 && r.stdout ? r.stdout : null;
}

/**
 * Programmatically commit the ledger + the given artifact paths on the CURRENT branch.
 * Commits only the named pathspecs (never `git add -A`), so an autonomous agent's concurrent
 * working-tree changes are untouched. A no-op (returns {committed:false}) when nothing is staged.
 * Never switches branches; if HEAD isn't on `expectedBranch` we still commit on wherever we are
 * but report the drift.
 */
export function commitState({ cwd, paths, message, expectedBranch, force = [] }) {
  const rel = paths.filter(Boolean);
  if (rel.length === 0) return { committed: false, reason: 'no-paths' };

  // `force` holds paths that are gitignored WHILE LIVE and may only be archived once finished —
  // the raw event stream (see .gitignore). Adding one puts it in the index, which is what "tracked"
  // means, so the path-limited commit below picks it up.
  const forced = force.filter(Boolean);
  if (forced.length) gitLocking(cwd, ['add', '-f', '--', ...forced]);

  const add = gitLocking(cwd, ['add', '--', ...rel]);
  if (add.code !== 0) return { committed: false, reason: `add-failed: ${add.stderr}` };

  // Anything actually staged among these paths?
  const staged = git(cwd, ['diff', '--cached', '--quiet', '--', ...rel]);
  if (staged.code === 0) return { committed: false, reason: 'nothing-staged' };

  const branch = currentBranch(cwd);
  const commit = gitLocking(cwd, ['commit', '-m', message, '--', ...rel]);
  if (commit.code !== 0) return { committed: false, reason: `commit-failed: ${commit.stderr}` };

  return {
    committed: true,
    branch,
    branchDrift: expectedBranch != null && branch !== expectedBranch ? { expectedBranch, branch } : null,
  };
}
