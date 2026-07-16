/**
 * loop.mjs — the scheduler state machine.
 *
 * A pool of `maxParallel` SLOTS. Each slot independently picks the next task (fewest-completed-runs
 * → per-task rounds), renders its prompt, runs it via runner.mjs, and — once it settles — cools down
 * for `interval` before taking another. `maxParallel: 1` is the sequential engine (run → sleep →
 * run); N slots are N independent lanes. A task never occupies two slots at once (selectTask
 * excludes the busy ones), so per-task rounds stay unambiguous.
 *
 * The SCHEDULER (this loop) is the sole owner of the control channel — it read-and-clears
 * state/control and fans the command out to the live slots. Workers never poll it: with several
 * workers a per-worker `takeControl` would steal commands from its siblings.
 *
 * Also handles the session-limit flow: rotate to a backup bin immediately (continuation prompt,
 * since --resume is account-scoped), or — when all bins are limited — wait for the soonest reset and
 * resume. Persists live state to state/runtime.json every tick and commits the durable ledger
 * (state.json) + artifacts on the run's branch at each run boundary.
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
  taskRound,
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
 *   interval, startDelay, maxParallel   overrides (fall back to cfg.*)
 */
export async function runLoop(cfg, opts = {}) {
  const { paths } = cfg;
  mkdirSync(paths.stateDir, { recursive: true });
  mkdirSync(paths.roundsDir, { recursive: true });

  // A loop that dies silently reads as "running" forever (status just re-reads the last runtime.json).
  // Log a clear boundary so a restart — by hand or by the watchdog — is visible in loop.log's timeline,
  // and keep a transient fault (a rejected write, a flaky throw) from taking the whole process down:
  // the worker attempt loop already isolates run failures, so a stray top-level fault is not fatal.
  if (!opts.dryRun) {
    log(`loop starting — pid ${process.pid}, instance ${cfg.name}`);
    process.on('uncaughtException', (e) => log(`uncaughtException (continuing): ${e?.stack || e}`));
    process.on('unhandledRejection', (e) => log(`unhandledRejection (continuing): ${e?.stack || e}`));
  }

  // An instance has exactly ONE loop, and it is the sole writer of the ledger. So a run still marked
  // `running` at startup belongs to a loop that died before it could record an outcome (killed
  // terminal, crash, reboot) — it will never be updated. Reap it, or it lies in `status` forever.
  if (!opts.dryRun) reapAbandonedRuns(cfg);

  const branch = currentBranch(cfg.cwd) ?? '(detached)';
  const bins = cfg.claude.bins.map((name) => ({ name, limitedUntil: 0 }));
  const interval = (opts.interval ?? cfg.interval) * 1000;
  const startDelay = (opts.startDelay ?? cfg.startDelay) * 1000;
  const single = !!(opts.once || opts.forcedTask || opts.dryRun);
  // A single pass is one task by definition; otherwise honor the config/CLI parallelism.
  const maxParallel = single ? 1 : Math.max(1, opts.maxParallel ?? cfg.maxParallel);

  const launch = nowMs();
  // Shared, scheduler-owned signals. Workers read them; only the scheduler writes them.
  const bus = { stopping: false, paused: false };

  /** A lane: idle → running (its own attempt loop) → cooling down until `readyAt` → idle. */
  const slots = Array.from({ length: maxParallel }, (_, i) => ({
    slot: i + 1,
    state: startDelay > 0 ? 'waiting-for-start' : 'idle',
    readyAt: launch + startDelay,
    started: false, // has this lane ever launched? (distinguishes waiting-for-start from sleeping)
    task: null,
    round: null,
    attempt: null,
    activeBin: null,
    runStartedAt: null,
    child: null,
    lastResult: null,
    progressFile: null,
    limit: { hit: false, resetAt: null },
    ctrl: null, // the live attempt controller — never serialized
    promise: null, // the in-flight worker — never serialized
  }));

  const busyTasks = () => new Set(slots.filter((s) => s.promise).map((s) => s.task).filter(Boolean));
  const liveSlots = () => slots.filter((s) => s.ctrl && !s.ctrl.settled());

  const runtime = {
    instance: cfg.name,
    pid: process.pid,
    state: 'idle',
    branch,
    bins,
    maxParallel,
    taskCount: null,
    slots: [],
    nextRunAt: null,
    updatedAt: null,
  };

  /** Aggregate the lanes into one headline state for the TUI / `status`. */
  const aggregate = () => {
    if (bus.stopping) return 'stopped';
    if (bus.paused) return 'paused';
    const st = slots.map((s) => s.state);
    if (st.includes('running')) return 'running';
    if (st.includes('waiting-for-reset')) return 'waiting-for-reset';
    if (st.includes('waiting-for-start')) return 'waiting-for-start';
    if (st.includes('sleeping')) return 'sleeping';
    return 'idle';
  };

  const writeRt = () => {
    for (const s of slots) {
      if (s.promise) continue; // the worker owns its state while it runs
      s.state = s.readyAt > nowMs() ? (s.started ? 'sleeping' : 'waiting-for-start') : 'idle';
    }
    runtime.state = aggregate();
    runtime.slots = slots.map(({ ctrl, promise, readyAt, ...rest }) => ({
      ...rest,
      readyAt: readyAt ? new Date(readyAt).toISOString() : null,
    }));
    // The headline countdown = the soonest lane to (re)start.
    const pending = slots.filter((s) => !s.promise).map((s) => s.readyAt);
    runtime.nextRunAt = pending.length ? new Date(Math.min(...pending)).toISOString() : null;
    writeRuntime(paths.runtime, runtime);
  };
  writeRt();

  // --- dry run: render the next selection and return, no side effects ------
  if (opts.dryRun) {
    const state = loadState(paths.stateJson);
    const sel = selectTask(cfg, state, opts.forcedTask ?? null);
    const { originalPrompt, ctx } = renderFor(cfg, sel, branch, paths);
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

  /** Interruptible wait shared by the lanes (start-delay / cooldown / reset). */
  const waitUntil = async (targetMs) => {
    while (nowMs() < targetMs) {
      if (bus.stopping) return 'stopped';
      await sleep(Math.min(POLL_MS, Math.max(1, targetMs - nowMs())));
    }
    return 'reached';
  };

  /**
   * One lane's work: run (round, task) to a settled outcome, retrying across bins/limits.
   * Resolves to 'done' | 'error' | 'skip' | 'stop'.
   */
  async function runTask(slot, sel) {
    const progressFile = paths.progressFile(sel.round, sel.task);
    const { originalPrompt, vars, subagents } = renderFor(cfg, sel, branch, paths);

    Object.assign(slot, {
      task: sel.task,
      round: sel.round,
      taskIndex: sel.taskIndex,
      progressFile,
      started: true,
      limit: { hit: false, resetAt: null },
    });
    runtime.taskCount = sel.taskCount;

    seedProgress(progressFile, { instance: cfg.name, task: sel.task, round: sel.round });

    let attempt = 0;
    let resumeSessionId = null;
    let sessionBin = null;
    let settled = null; // 'done' | 'error' | 'skip' | 'stop'
    let hadLimit = false;

    while (settled == null) {
      // Choose an available bin, or wait for the soonest reset if all are limited.
      let activeBin = pickBin(bins);
      if (!activeBin) {
        hadLimit = true;
        slot.limit = { hit: true, resetAt: new Date(soonestReset(bins)).toISOString() };
        slot.state = 'waiting-for-reset';
        log(`[slot ${slot.slot}] all bins limited — waiting for reset at ${slot.limit.resetAt}`);
        if ((await waitUntil(soonestReset(bins))) === 'stopped') {
          settled = 'stop';
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

      Object.assign(slot, {
        ctrl,
        state: bus.paused ? 'paused' : 'running',
        attempt,
        activeBin: activeBin.name,
        runStartedAt: new Date().toISOString(),
        child: { pid: ctrl.child.pid, sessionId: null },
      });
      // A pause that landed while this lane was between attempts must still take effect.
      if (bus.paused) ctrl.pause();
      log(`[slot ${slot.slot}] ${sel.task} round ${sel.round} attempt ${attempt} → ${activeBin.name} (pid ${ctrl.child.pid})`);

      // Track the live view until the attempt settles. Control is dispatched by the scheduler.
      while (!ctrl.settled()) {
        await sleep(POLL_MS);
        slot.child = { pid: ctrl.child.pid, sessionId: ctrl.live.sessionId };
        slot.lastResult = {
          activity: ctrl.live.activity,
          tool: ctrl.live.tool,
          usage: ctrl.live.usage,
          costUsd: ctrl.live.costUsd,
        };
      }

      const result = await ctrl.done;
      result.attempt = attempt;
      slot.ctrl = null;
      resumeSessionId = result.sessionId;
      sessionBin = activeBin.name;
      slot.lastResult = {
        subtype: result.subtype,
        isError: result.isError,
        outcome: result.outcome,
        costUsd: result.costUsd,
        usage: result.usage,
      };

      recordRunEnd(cfg, { task: sel.task, round: sel.round, attempt, bin: activeBin.name, result, branch });

      if (result.intent === 'stop') {
        // A deliberate stop ENDS this round. It was neither completed nor is it a resumable usage
        // limit (pause/continue is the resume path, not stop). If we left the round unconsumed the
        // next launch would re-select the SAME round and re-enter its now-dead directory — inheriting
        // the killed attempt's PROGRESS.md (seedProgress won't overwrite) and stale evidence. Consume
        // it so the next launch starts a fresh round in a clean dir. (Only `limit` keeps the round.)
        bumpAndCommit(cfg, { task: sel.task, round: sel.round, branch });
        settled = 'stop';
      } else if (result.intent === 'skip') {
        bumpAndCommit(cfg, { task: sel.task, round: sel.round, branch });
        settled = 'skip';
      } else if (result.intent === 'relaunch') {
        log(`[slot ${slot.slot}] resumed after long pause — relaunching ${sel.task} via --resume`);
        // same bin, same session → next attempt uses --resume
      } else if (result.outcome === 'limit') {
        hadLimit = true;
        const until = result.resetAt ?? nowMs() + limitBackoffMs();
        activeBin.limitedUntil = until;
        log(`[slot ${slot.slot}] bin ${activeBin.name} limited until ${new Date(until).toISOString()}`);
        const alt = pickBin(bins);
        if (alt) log(`[slot ${slot.slot}] rotating to backup bin ${alt.name} (continuation prompt, no --resume)`);
        // else: next iteration hits the all-limited wait branch above
      } else {
        // done or error → this round is consumed; the lane moves on
        bumpAndCommit(cfg, { task: sel.task, round: sel.round, branch });
        settled = result.outcome; // 'done' | 'error'
      }
    }

    // Cool down before this lane takes another task — unless a limit already ate the time
    // (catch-up: go straight back in) or we're shutting down.
    slot.readyAt = hadLimit || settled === 'stop' ? nowMs() : nowMs() + interval;
    if (hadLimit && settled !== 'stop') log(`[slot ${slot.slot}] catch-up: taking the next task immediately`);
    slot.state = 'idle';
    slot.child = null;
    return settled;
  }

  // --- control dispatch (scheduler-only) ------------------------------------
  // `cmd [target]` — target is a task id or a slot number; without one, the command is broadcast.
  const dispatch = (raw) => {
    const [cmd, target] = String(raw).trim().split(/\s+/, 2);
    const targeted = target
      ? liveSlots().filter((s) => s.task === target || String(s.slot) === String(target))
      : liveSlots();
    if (target && targeted.length === 0) {
      log(`control "${cmd} ${target}" — no live slot matches; ignored`);
      return;
    }
    switch (cmd) {
      case 'pause':
        if (!target) bus.paused = true;
        for (const s of targeted) {
          s.ctrl.pause();
          s.state = 'paused';
        }
        log(`paused ${target ?? 'all slots'}`);
        return;
      case 'continue':
        if (!target) bus.paused = false;
        for (const s of targeted) {
          s.ctrl.resume();
          s.state = 'running';
        }
        log(`continued ${target ?? 'all slots'}`);
        return;
      case 'skip':
        for (const s of targeted) s.ctrl.skip();
        log(`skipped ${target ?? 'all slots'}`);
        return;
      case 'stop':
        bus.stopping = true;
        for (const s of liveSlots()) s.ctrl.stop();
        log(`stopping${target ? ` (requested for ${target}; stop is always global)` : ''}`);
        return;
      default:
        log(`unknown control command "${raw}" — ignored`);
    }
  };

  // --- the scheduler --------------------------------------------------------
  let completed = 0;
  try {
    while (true) {
      const cmd = takeControl(paths.control);
      if (cmd) dispatch(cmd);
      if (bus.stopping) break;

      if (!bus.paused) {
        for (const slot of slots) {
          if (slot.promise || nowMs() < slot.readyAt) continue;
          if (single && (completed > 0 || slots.some((s) => s.promise))) break;

          const sel = selectTask(cfg, loadState(paths.stateJson), opts.forcedTask ?? null, busyTasks());
          if (!sel) break; // every task is already occupying a slot — leave this lane idle
          slot.promise = runTask(slot, sel)
            .catch((e) => {
              log(`[slot ${slot.slot}] worker crashed: ${e?.stack || e}`);
              slot.state = 'idle';
              slot.readyAt = nowMs() + interval;
              return 'error';
            })
            .then((outcome) => {
              completed += 1;
              slot.promise = null;
              return outcome;
            });
        }
      }

      const live = slots.filter((s) => s.promise);
      if (single && completed > 0 && live.length === 0) break;

      writeRt();
      await sleep(POLL_MS);
    }
  } finally {
    // Let the lanes unwind (their children are already signalled) before reporting stopped.
    await Promise.allSettled(slots.map((s) => s.promise).filter(Boolean));
    for (const s of slots) {
      s.state = 'stopped';
      s.child = null;
      s.promise = null;
    }
    runtime.state = 'stopped';
    writeRt();
    log(`loop stopped.`);
  }
}

// --- helpers ---------------------------------------------------------------

/** Render a selection's prompt + template context (shared by the dry run and the lanes). */
function renderFor(cfg, sel, branch, paths) {
  const ctx = buildCtx(cfg, sel, branch);
  const progressFile = paths.progressFile(sel.round, sel.task);
  const vars = { ...ctx, progressFile, ...cfg.vars(ctx) };
  const subagents = cfg.subagents(ctx);
  const templateFile = join(paths.dir, sel.round === 1 ? cfg.firstRoundTemplate : cfg.nextRoundTemplate);
  const rendered = renderTemplate(templateFile, { vars, subagents });
  if (rendered.warnings.length) log(`unresolved template vars: ${rendered.warnings.join(', ')}`);
  return { originalPrompt: rendered.text, vars, subagents, ctx, progressFile };
}

function buildContinuation(cfg, vars, subagents, originalPrompt) {
  const v = { ...vars, originalPrompt };
  if (cfg.continueTemplate) {
    return renderTemplate(join(cfg.paths.dir, cfg.continueTemplate), { vars: v, subagents }).text;
  }
  return renderString(BUILTIN_CONTINUE, { vars: v, subagents }).text;
}

/** commit paths (relative to cfg.cwd) for the ledger + a (round,task)'s artifact tree. */
function commitPaths(cfg, round, task) {
  return [relative(cfg.cwd, cfg.paths.stateJson), relative(cfg.cwd, cfg.paths.runDir(round, task))];
}

// The three ledger writers below are fully SYNCHRONOUS (load → mutate → save → commit, no `await`).
// On the single JS thread that makes each one atomic with respect to the other lanes, so parallel
// slots need no lock: two workers can never interleave a read-modify-write of state.json.

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
    // The attempt has settled, so its raw stream is closed and safe to archive. It stays gitignored
    // while live — a tracked file that is being appended to gets its inode swapped out by any agent
    // `git stash`/`checkout`, and the rest of the stream is written to a deleted file.
    force: [join(relative(cfg.cwd, cfg.paths.attemptDir(round, task, attempt)), 'output.jsonl')],
    message: `chore(automation/${cfg.name}): ${task} round ${round} attempt ${attempt} ${result.outcome}`,
    expectedBranch: branch,
  });
}

/** Mark every run left `running` by a previous (now-dead) loop as `abandoned`. */
function reapAbandonedRuns(cfg) {
  const state = loadState(cfg.paths.stateJson);
  const stale = state.runs.filter((r) => r.outcome === 'running');
  if (!stale.length) return;
  const endedAt = new Date().toISOString();
  let consumed = 0;
  for (const r of stale) {
    r.outcome = 'abandoned';
    r.endedAt = endedAt;
    // A loop that died mid-run leaves an unresumable, half-populated round dir. Consume that round
    // (like a stop) so the next launch starts fresh instead of re-entering the dead dir. Guarded by
    // `taskRound < r.round` so it fires ONCE even with several abandoned entries for the same round,
    // and never rolls a round back that a later done/error already advanced past.
    if (taskRound(state, r.task) < r.round) {
      bumpTaskRound(state, r.task);
      consumed += 1;
    }
  }
  saveState(cfg.paths.stateJson, state);
  log(`reaped ${stale.length} abandoned run(s) from a previous loop${consumed ? ` (consumed ${consumed} round(s))` : ''}`);
  commitState({
    cwd: cfg.cwd,
    paths: [relative(cfg.cwd, cfg.paths.stateJson)],
    message: `chore(automation/${cfg.name}): reap ${stale.length} abandoned run(s)`,
    expectedBranch: currentBranch(cfg.cwd),
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
