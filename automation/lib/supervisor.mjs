/**
 * supervisor.mjs — keep an instance's loop alive without human babysitting.
 *
 * The loop is a long-lived process. It can die silently — an OOM kill, the machine sleeping, an
 * uncaught fault — and then `status` keeps reading the last runtime.json and reports a loop that is
 * actually gone (this cost ~5h of dead time once). `ensureLoop` is the cure: a cheap, idempotent
 * check that restarts the loop ONLY when its recorded pid is truly gone. Run it from cron
 * (`lmauto schedule <inst> watch-install`) so the OS supervises the supervisor.
 *
 * The one invariant that matters: NEVER spawn a second loop while one is alive. Two loops share a
 * state.json and both pick tasks — they would double every run and race the ledger. So a restart
 * happens only when signal-0 to the recorded pid fails (the process is genuinely gone); a pid that
 * still answers is left strictly alone, even if its heartbeat looks stale.
 *
 * Zero dependencies — Node built-ins only.
 */
import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { join } from 'node:path';
import { AUTOMATION_ROOT } from './config.mjs';
import { readRuntime } from './state.mjs';

const LMAUTO = join(AUTOMATION_ROOT, 'lmauto.mjs');
// The loop writes runtime.json every poll (~1s) whenever it is alive, so a heartbeat older than this
// means the writer is not running. It is only a diagnostic — the restart decision is the pid probe.
const STALE_MS = 90_000;

/** True if `pid` is a live process. signal 0 probes existence without delivering a signal. */
export function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM'; // exists but owned by someone else — still alive
  }
}

/**
 * Classify a loop from its runtime.json:
 *   alive   — pid answers and the heartbeat is fresh
 *   dead    — pid is gone → safe to restart
 *   stopped — an operator stopped it cleanly → leave it
 *   absent  — never started → leave it
 *   stale   — pid answers but the heartbeat is old (wedged, or a reused pid) → do NOT duplicate it
 */
export function loopStatus(cfg) {
  const rt = readRuntime(cfg.paths.runtime, null);
  if (!rt) return { state: 'absent', rt: null, ageMs: Infinity };
  const ageMs = rt.updatedAt ? Date.now() - Date.parse(rt.updatedAt) : Infinity;
  if (rt.state === 'stopped') return { state: 'stopped', rt, ageMs };
  if (!pidAlive(rt.pid)) return { state: 'dead', rt, ageMs };
  if (ageMs > STALE_MS) return { state: 'stale', rt, ageMs };
  return { state: 'alive', rt, ageMs };
}

/** Spawn a detached loop whose stdout/stderr append to loop.log — the same shape as the nohup start. */
export function spawnLoopDetached(cfg) {
  const fd = openSync(cfg.paths.loopLog, 'a');
  const child = spawn(process.execPath, [LMAUTO, 'loop', cfg.name], {
    cwd: AUTOMATION_ROOT,
    detached: true,
    stdio: ['ignore', fd, fd],
  });
  child.unref();
  return child.pid;
}

/**
 * The watchdog's one action, idempotent and safe to run on any schedule.
 * Restarts the loop only when it is genuinely `dead`; every other state is left untouched.
 */
export function ensureLoop(cfg, { log = console.log } = {}) {
  const s = loopStatus(cfg);
  const stamp = new Date().toISOString();
  const age = Number.isFinite(s.ageMs) ? `${Math.round(s.ageMs / 1000)}s` : 'n/a';
  switch (s.state) {
    case 'alive':
      return s; // quiet: the common case, runs every couple of minutes
    case 'stopped':
      return s; // an operator stopped it on purpose — respect that
    case 'absent':
      log(`[${stamp}] [ensure] ${cfg.name}: never started — run \`lmauto loop ${cfg.name}\` once to begin`);
      return s;
    case 'stale':
      log(
        `[${stamp}] [ensure] ${cfg.name}: pid ${s.rt.pid} still answers but its heartbeat is ${age} old — ` +
          `NOT restarting (a second loop would race the ledger); investigate`,
      );
      return s;
    case 'dead': {
      const pid = spawnLoopDetached(cfg);
      log(
        `[${stamp}] [ensure] ${cfg.name}: loop pid ${s.rt?.pid ?? '?'} is gone (heartbeat ${age} old, ` +
          `state was ${s.rt?.state ?? '?'}) — RESTARTED as pid ${pid}`,
      );
      return { ...s, restartedPid: pid };
    }
    default:
      return s;
  }
}
