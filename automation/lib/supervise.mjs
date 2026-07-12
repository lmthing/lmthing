/**
 * supervise.mjs — a time-boxed window driver around the loop.
 *
 * Waits an optional start-delay, then runs the loop until a hard deadline, then stops cleanly.
 * Absolute start/deadline epochs are persisted (state/supervisor.json) so a restart resumes the
 * same window rather than extending it. The deadline is enforced by dropping a `stop` control
 * command — the same channel the loop already honors — so no special loop wiring is needed.
 *
 * Env (all optional): START_DELAY (s, default 7200), DURATION (s, default 172800),
 * RUN_INTERVAL (s, default cfg.interval), START_EPOCH / DEADLINE_EPOCH (override on restart).
 *
 * Zero dependencies — Node built-ins only.
 */
import { join } from 'node:path';
import { runLoop } from './loop.mjs';
import { readJson, writeJsonAtomic, writeControl } from './state.mjs';

const nowS = () => Math.floor(Date.now() / 1000);

export async function supervise(cfg, opts = {}) {
  const supFile = join(cfg.paths.stateDir, 'supervisor.json');
  const prior = readJson(supFile, null);

  const startDelay = opts.startDelay ?? (process.env.START_DELAY ? Number(process.env.START_DELAY) : 7200);
  const duration = opts.duration ?? (process.env.DURATION ? Number(process.env.DURATION) : 172800);
  const interval = opts.interval ?? (process.env.RUN_INTERVAL ? Number(process.env.RUN_INTERVAL) : cfg.interval);

  const startEpoch = Number(process.env.START_EPOCH) || prior?.startEpoch || nowS() + startDelay;
  const deadlineEpoch = Number(process.env.DEADLINE_EPOCH) || prior?.deadlineEpoch || nowS() + duration;

  writeJsonAtomic(supFile, { pid: process.pid, startEpoch, deadlineEpoch, interval, updatedAt: new Date().toISOString() });
  process.stdout.write(
    `[supervisor] window ${new Date(startEpoch * 1000).toISOString()} → ${new Date(deadlineEpoch * 1000).toISOString()} interval=${interval}s\n`,
  );

  const msUntilDeadline = deadlineEpoch * 1000 - Date.now();
  if (msUntilDeadline <= 0) {
    process.stdout.write(`[supervisor] deadline already passed — nothing to do\n`);
    return;
  }
  // Watchdog: at the deadline, ask the loop to stop.
  const watchdog = setTimeout(() => {
    process.stdout.write(`[supervisor] deadline reached — signalling stop\n`);
    writeControl(cfg.paths.control, 'stop');
  }, msUntilDeadline);
  watchdog.unref?.();

  // The loop's own start-delay handles the wait until startEpoch.
  const loopStartDelay = Math.max(0, startEpoch - nowS());
  await runLoop(cfg, { startDelay: loopStartDelay, interval });
  clearTimeout(watchdog);
  process.stdout.write(`[supervisor] done.\n`);
}
