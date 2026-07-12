/**
 * loop.mjs — the scheduler state machine.
 *
 * Selects the next task (fewest-completed-runs → per-task rounds), renders its prompt, runs it via
 * runner.mjs, and reacts to control commands (pause/continue/skip/stop). Handles the session-limit
 * flow: rotate to a backup bin immediately (continuation prompt, since --resume is account-scoped),
 * or — when all bins are limited — wait for the soonest reset and resume. Persists live state to
 * state/runtime.json every transition and commits the durable ledger (state.json) + artifacts on
 * the run's branch at each run boundary.
 *
 * Zero dependencies — Node built-ins only.
 */
import { mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildCtx, selectTask } from './config.mjs';
import { renderTemplate, renderString } from './template.mjs';
import {
  loadState,
  saveState,
  bumpTaskRound,
  writeRuntime,
  takeControl,
  commitState,
  currentBranch,
} from './state.mjs';
import { startRun, buildArgv, redactArgv, seedProgress } from './runner.mjs';

const POLL_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowMs = () => Date.now();

const BUILTIN_CONTINUE = `# Continuation — resume interrupted work on task \`{{task}}\` (round {{round}})

A previous Claude session working on THIS task was interrupted (a usage limit on a different
account). You are a DIFFERENT account and do NOT share that session's memory — but the work is
partly done. **Continue from where it left off; do not restart from scratch.**

1. **Read your progress log FIRST:** {{progressFile}} — it records what prior steps did and which
   files were added to context. Resume from the last incomplete step.
2. Inspect the working tree / recent commits on \`{{branch}}\` to see what already landed.
3. Keep updating {{progressFile}} at every step, and **commit early & often to \`{{branch}}\`**.

--- ORIGINAL TASK PROMPT (full context) ---

{{originalPrompt}}
`;

function thresholdMs() {
  return (process.env.PAUSE_KILL_THRESHOLD ? Number(process.env.PAUSE_KILL_THRESHOLD) : 120) * 1000;
}
function limitBackoffMs() {
  return (process.env.LIMIT_BACKOFF ? Number(process.env.LIMIT_BACKOFF) : 3600) * 1000;
}

function pickBin(bins) {
  return bins.find((b) => b.limitedUntil <= nowMs()) ?? null;
}
function soonestReset(bins) {
  return Math.min(...bins.map((b) => b.limitedUntil));
}

/** Log a line to the loop's stdout (also visible in state/loop.log when redirected there). */
function log(msg) {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

/**
 * Run the loop. Options:
 *   forcedTask   run this task (doesn't change counts); implies a single pass
 *   once         run exactly one task then return (used by `run`)
 *   dryRun       render + print prompt/argv, don't spawn/commit/count
 *   interval, startDelay   overrides (fall back to cfg.*)
 */
export async function runLoop(cfg, opts = {}) {
  const { paths } = cfg;
  mkdirSync(paths.stateDir, { recursive: true });
  mkdirSync(paths.roundsDir, { recursive: true });

  const branch = currentBranch(cfg.cwd) ?? '(detached)';
  const bins = cfg.claude.bins.map((name) => ({ name, limitedUntil: 0 }));
  const interval = (opts.interval ?? cfg.interval) * 1000;
  const startDelay = (opts.startDelay ?? cfg.startDelay) * 1000;
  const single = !!(opts.once || opts.forcedTask || opts.dryRun);

  const runtime = {
    instance: cfg.name,
    pid: process.pid,
    state: 'idle',
    branch,
    bins,
    task: null,
    round: null,
    attempt: null,
    taskIndex: null,
    taskCount: null,
    runStartedAt: null,
    child: null,
    activeBin: null,
    lastResult: null,
    limit: { hit: false, resetAt: null },
    nextRunAt: null,
    catchUp: false,
    progressFile: null,
  };
  const writeRt = () => writeRuntime(paths.runtime, runtime);
  writeRt();

  const launch = nowMs();
  let firstRun = true;
  let catchUp = false;

  // The single interruptible waiter, shared by start-delay / sleeping / waiting-for-reset.
  // Returns 'reached' or 'stopped'.
  const waitUntil = async (targetMs, state) => {
    runtime.state = state;
    runtime.nextRunAt = new Date(targetMs).toISOString();
    writeRt();
    while (nowMs() < targetMs) {
      await sleep(Math.min(POLL_MS, targetMs - nowMs()));
      const cmd = takeControl(paths.control);
      if (cmd === 'stop') return 'stopped';
      writeRt();
    }
    runtime.nextRunAt = null;
    return 'reached';
  };

  try {
    while (true) {
      if (firstRun && startDelay > 0) {
        if ((await waitUntil(launch + startDelay, 'waiting-for-start')) === 'stopped') break;
      }
      firstRun = false;

      const state = loadState(paths.stateJson);
      const sel = selectTask(cfg, state, opts.forcedTask ?? null);
      const ctx = buildCtx(cfg, sel, branch);
      const progressFile = paths.progressFile(sel.round, sel.task);
      const vars = { ...ctx, progressFile, ...cfg.vars(ctx) };
      const subagents = cfg.subagents(ctx);
      const templateFile = join(paths.dir, sel.round === 1 ? cfg.firstRoundTemplate : cfg.nextRoundTemplate);
      const rendered = renderTemplate(templateFile, { vars, subagents });
      if (rendered.warnings.length) log(`unresolved template vars: ${rendered.warnings.join(', ')}`);
      const originalPrompt = rendered.text;

      Object.assign(runtime, {
        task: sel.task,
        round: sel.round,
        taskIndex: sel.taskIndex,
        taskCount: sel.taskCount,
        progressFile,
        catchUp,
        limit: { hit: false, resetAt: null },
      });

      // --- dry run: print and return, no side effects -------------------
      if (opts.dryRun) {
        const bin = (pickBin(bins) ?? bins[0]).name;
        const argv = buildArgv({ bin, promptText: originalPrompt, cfg });
        log(`DRY RUN — instance=${cfg.name} task=${sel.task} round=${sel.round} (${ctx.roundMode}) bin=${bin}`);
        process.stdout.write('\n===== rendered prompt =====\n');
        process.stdout.write(originalPrompt + '\n');
        process.stdout.write('\n===== claude argv =====\n');
        process.stdout.write(redactArgv(argv).join(' \\\n  ') + '\n');
        runtime.state = 'idle';
        writeRt();
        return;
      }

      seedProgress(progressFile, { instance: cfg.name, task: sel.task, round: sel.round });

      // --- attempt loop (resume / rotation within one (round,task)) -----
      let attempt = 0;
      let resumeSessionId = null;
      let sessionBin = null;
      let taskSettled = null; // 'done' | 'error' | 'skip' | 'stop'
      let hadLimit = false;

      while (taskSettled == null) {
        // Choose an available bin, or wait for the soonest reset if all are limited.
        let activeBin = pickBin(bins);
        if (!activeBin) {
          hadLimit = true;
          catchUp = true;
          runtime.limit = { hit: true, resetAt: new Date(soonestReset(bins)).toISOString() };
          log(`all bins limited — waiting for reset at ${runtime.limit.resetAt}`);
          if ((await waitUntil(soonestReset(bins), 'waiting-for-reset')) === 'stopped') {
            taskSettled = 'stop';
            break;
          }
          bins.forEach((b) => {
            if (b.limitedUntil <= nowMs()) b.limitedUntil = 0;
          });
          activeBin = pickBin(bins) ?? bins[0];
        }

        attempt += 1;
        // Same bin as the session → --resume; different bin (or none) → continuation prompt.
        const sameBin = resumeSessionId && sessionBin === activeBin.name;
        let promptText = originalPrompt;
        let useResume = null;
        if (sameBin) {
          useResume = resumeSessionId;
        } else if (resumeSessionId) {
          promptText = buildContinuation(cfg, { ...vars }, subagents, originalPrompt);
        }

        const attemptDir = paths.attemptDir(sel.round, sel.task, attempt);
        recordRunStart(cfg, { task: sel.task, round: sel.round, attempt, bin: activeBin.name });

        const ctrl = startRun({
          bin: activeBin.name,
          promptText,
          cfg,
          attemptDir,
          resumeSessionId: useResume,
          thresholdMs: thresholdMs(),
        });

        Object.assign(runtime, {
          state: 'running',
          attempt,
          activeBin: activeBin.name,
          runStartedAt: new Date().toISOString(),
          child: { pid: ctrl.child.pid, sessionId: null },
        });
        writeRt();

        // Supervise: poll control + refresh live view until the attempt settles.
        while (!ctrl.settled()) {
          await sleep(POLL_MS);
          runtime.child = { pid: ctrl.child.pid, sessionId: ctrl.live.sessionId };
          runtime.lastResult = { activity: ctrl.live.activity, tool: ctrl.live.tool, usage: ctrl.live.usage, costUsd: ctrl.live.costUsd };
          const cmd = takeControl(paths.control);
          if (cmd === 'pause') {
            ctrl.pause();
            runtime.state = 'paused';
          } else if (cmd === 'continue') {
            ctrl.resume();
            runtime.state = 'running';
          } else if (cmd === 'skip') {
            ctrl.skip();
          } else if (cmd === 'stop') {
            ctrl.stop();
          }
          writeRt();
        }

        const result = await ctrl.done;
        result.attempt = attempt;
        resumeSessionId = result.sessionId;
        sessionBin = activeBin.name;
        runtime.lastResult = { subtype: result.subtype, isError: result.isError, outcome: result.outcome, costUsd: result.costUsd, usage: result.usage };

        recordRunEnd(cfg, { task: sel.task, round: sel.round, attempt, bin: activeBin.name, result, branch });

        if (result.intent === 'stop') {
          taskSettled = 'stop';
        } else if (result.intent === 'skip') {
          bumpAndCommit(cfg, { task: sel.task, round: sel.round, branch });
          taskSettled = 'skip';
        } else if (result.intent === 'relaunch') {
          log(`resumed after long pause — relaunching ${sel.task} via --resume`);
          // same bin, same session → next attempt uses --resume
        } else if (result.outcome === 'limit') {
          hadLimit = true;
          const until = result.resetAt ?? nowMs() + limitBackoffMs();
          activeBin.limitedUntil = until;
          log(`bin ${activeBin.name} limited until ${new Date(until).toISOString()}`);
          const alt = pickBin(bins);
          if (alt) {
            log(`rotating to backup bin ${alt.name} (continuation prompt, no --resume)`);
            // loop continues: next attempt picks alt, uses continuation prompt (different bin)
          }
          // else: next loop iteration hits the all-limited wait branch above
        } else {
          // done or error → count this round as consumed; move on
          bumpAndCommit(cfg, { task: sel.task, round: sel.round, branch });
          taskSettled = result.outcome; // 'done' | 'error'
        }
      }

      if (taskSettled === 'stop') break;

      if (single) return;

      if (catchUp) {
        catchUp = false;
        runtime.catchUp = false;
        writeRt();
        log(`catch-up: starting next task immediately`);
        continue;
      }
      if ((await waitUntil(nowMs() + interval, 'sleeping')) === 'stopped') break;
    }
  } finally {
    runtime.state = 'stopped';
    runtime.child = null;
    writeRt();
    log(`loop stopped.`);
  }
}

// --- helpers ---------------------------------------------------------------

function buildContinuation(cfg, vars, subagents, originalPrompt) {
  const v = { ...vars, originalPrompt };
  if (cfg.continueTemplate) {
    return renderTemplate(join(cfg.paths.dir, cfg.continueTemplate), { vars: v, subagents }).text;
  }
  return renderString(BUILTIN_CONTINUE, { vars: v, subagents }).text;
}

/** commit paths (relative to cfg.cwd) for the ledger + a (round,task)'s artifact tree. */
function commitPaths(cfg, round, task) {
  return [
    relative(cfg.cwd, cfg.paths.stateJson),
    relative(cfg.cwd, cfg.paths.runDir(round, task)),
  ];
}

/** Append a "running" run entry to the ledger and commit (run-start boundary). */
function recordRunStart(cfg, { task, round, attempt, bin }) {
  const state = loadState(cfg.paths.stateJson);
  state.runs.push({ task, round, attempt, bin, outcome: 'running', startedAt: new Date().toISOString(), endedAt: null });
  saveState(cfg.paths.stateJson, state);
  commitState({
    cwd: cfg.cwd,
    paths: commitPaths(cfg, round, task),
    message: `chore(automation/${cfg.name}): ${task} round ${round} attempt ${attempt} start`,
    expectedBranch: currentBranch(cfg.cwd),
  });
}

/** Update the matching run entry with the finished result and commit (run-end boundary). */
function recordRunEnd(cfg, { task, round, attempt, bin, result, branch }) {
  const state = loadState(cfg.paths.stateJson);
  const entry = [...state.runs].reverse().find((r) => r.task === task && r.round === round && r.attempt === attempt);
  const patch = {
    bin,
    outcome: result.outcome,
    subtype: result.subtype,
    isError: result.isError,
    costUsd: result.costUsd,
    usage: result.usage,
    resetAt: result.resetAt ? new Date(result.resetAt).toISOString() : null,
    endedAt: result.endedAt,
  };
  if (entry) Object.assign(entry, patch);
  else state.runs.push({ task, round, attempt, ...patch, startedAt: result.startedAt });
  saveState(cfg.paths.stateJson, state);
  commitState({
    cwd: cfg.cwd,
    paths: commitPaths(cfg, round, task),
    message: `chore(automation/${cfg.name}): ${task} round ${round} attempt ${attempt} ${result.outcome}`,
    expectedBranch: branch,
  });
}

/** Increment a task's completed-run count and commit the ledger. */
function bumpAndCommit(cfg, { task, round, branch }) {
  const state = loadState(cfg.paths.stateJson);
  bumpTaskRound(state, task);
  saveState(cfg.paths.stateJson, state);
  commitState({
    cwd: cfg.cwd,
    paths: commitPaths(cfg, round, task),
    message: `chore(automation/${cfg.name}): ${task} round ${round} complete`,
    expectedBranch: branch,
  });
}
