/**
 * schedule.mjs — install/remove a cron entry that runs an instance's headless loop, and a status
 * view. The loop itself owns interval/start-delay/pause/limit handling; cron just relaunches
 * `lmauto loop <instance>` on a fixed 5-hour tick (survives reboot). For exact spacing on an
 * always-on machine, prefer `lmauto loop` under nohup/tmux.
 *
 * Zero dependencies — Node built-ins only.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { AUTOMATION_ROOT } from './config.mjs';
import { loadState, readRuntime } from './state.mjs';

const LMAUTO = join(AUTOMATION_ROOT, 'lmauto.mjs');

/** Resolve which directory on the install-time PATH holds an executable named `bin`. */
function whichDir(bin) {
  const r = spawnSync('command', ['-v', bin], { shell: true, encoding: 'utf8' });
  const p = r.status === 0 ? r.stdout.trim() : '';
  return p ? dirname(p) : '';
}

/**
 * cron runs with a minimal PATH (typically `/usr/bin:/bin`) that omits per-user install dirs like
 * `~/.local/bin` (where `claude` lives) and a user-local node — a loop the watchdog spawns then
 * inherits that PATH and every agent spawn dies with `spawn claude ENOENT`. So PREPEND just the dirs
 * that hold `node` and the configured claude bin(s) to cron's own `$PATH` (keeping it as fallback).
 * Compact — baking the whole install-time PATH overflows crontab's per-line limit.
 */
function pathPrefix(cfg) {
  const dirs = new Set([dirname(process.execPath)]); // the node running this install
  for (const bin of cfg?.claude?.bins ?? []) {
    const d = whichDir(bin);
    if (d) dirs.add(d);
  }
  const prefix = [...dirs].filter(Boolean).join(delimiter);
  return prefix ? `PATH="${prefix}:$PATH" ` : '';
}

function cronTag(name) {
  return `# lmthing-automation-${name}`;
}
function cronLine(cfg) {
  const log = cfg.paths.loopLog;
  return `0 */5 * * * cd ${AUTOMATION_ROOT} && ${pathPrefix(cfg)}node ${LMAUTO} loop ${cfg.name} >> ${log} 2>&1 ${cronTag(cfg.name)}`;
}

/**
 * The watchdog cron: every 2 minutes, `ensure` restarts the loop iff it has died. Idempotent — it
 * never spawns a second loop while one is alive — so it is the right thing to run on a fast tick and
 * the safe cure for a silent overnight death (bounds dead time to ≤2 min instead of a health check's
 * hour). The OS cron daemon supervises it, so it survives reboot and machine sleep.
 */
function watchTag(name) {
  return `# lmthing-automation-watch-${name}`;
}
function watchLine(cfg) {
  const log = cfg.paths.loopLog;
  return `*/2 * * * * cd ${AUTOMATION_ROOT} && ${pathPrefix(cfg)}node ${LMAUTO} ensure ${cfg.name} >> ${log} 2>&1 ${watchTag(cfg.name)}`;
}

function readCrontab() {
  const r = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : [];
}
function writeCrontab(lines) {
  const r = spawnSync('crontab', ['-'], { input: lines.join('\n') + '\n', encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`crontab write failed: ${r.stderr}`);
}

export function cronInstall(cfg) {
  const kept = readCrontab().filter((l) => !l.includes(cronTag(cfg.name)));
  const line = cronLine(cfg);
  writeCrontab([...kept, line]);
  process.stdout.write(`installed cron entry:\n  ${line}\nlogs → ${cfg.paths.loopLog}\n`);
}

export function cronRemove(cfg) {
  const kept = readCrontab().filter((l) => !l.includes(cronTag(cfg.name)));
  writeCrontab(kept);
  process.stdout.write(`removed cron entry for ${cfg.name}.\n`);
}

export function watchInstall(cfg) {
  const kept = readCrontab().filter((l) => !l.includes(watchTag(cfg.name)));
  const line = watchLine(cfg);
  writeCrontab([...kept, line]);
  process.stdout.write(
    `installed watchdog (every 2 min):\n  ${line}\n` +
      `it restarts the loop only if it has died; \`lmauto stop\` disables it (respects a clean stop).\n` +
      `logs → ${cfg.paths.loopLog}\n`,
  );
}

export function watchRemove(cfg) {
  const kept = readCrontab().filter((l) => !l.includes(watchTag(cfg.name)));
  writeCrontab(kept);
  process.stdout.write(`removed watchdog for ${cfg.name}.\n`);
}

export function status(cfg) {
  const crontab = readCrontab();
  const cron = crontab.find((l) => l.includes(cronTag(cfg.name)));
  const watch = crontab.find((l) => l.includes(watchTag(cfg.name)));
  process.stdout.write(`== instance: ${cfg.name} ==\n`);
  process.stdout.write(`cron:  ${cron ?? '(none)'}\n`);
  process.stdout.write(`watch: ${watch ? 'installed (ensure every 2 min)' : '(none — `lmauto schedule ' + cfg.name + ' watch-install`)'}\n\n`);

  const rt = existsSync(cfg.paths.runtime) ? readRuntime(cfg.paths.runtime) : null;
  if (rt) {
    if (Array.isArray(rt.slots)) {
      const busy = rt.slots.filter((s) => s.state === 'running' || s.state === 'paused').length;
      process.stdout.write(
        `runtime: state=${rt.state} parallel=${busy}/${rt.maxParallel ?? 1} ` +
          `nextRunAt=${rt.nextRunAt ?? '-'} (pid ${rt.pid})\n`,
      );
      for (const s of rt.slots) {
        process.stdout.write(
          `  [slot ${s.slot}] ${s.task ?? '—'} r${s.round ?? '-'} a${s.attempt ?? '-'} ${s.state}` +
            ` bin=${s.activeBin ?? '-'} readyAt=${s.readyAt ?? '-'}\n`,
        );
      }
    } else {
      // A loop started before slots existed is still running and owns this file — read it as it is.
      process.stdout.write(
        `runtime: state=${rt.state} task=${rt.task} round=${rt.round} attempt=${rt.attempt ?? '-'} ` +
          `bin=${rt.activeBin ?? '-'} nextRunAt=${rt.nextRunAt ?? '-'} (pid ${rt.pid}) [pre-slots loop]\n`,
      );
    }
    if (rt.bins?.some((b) => b.limitedUntil > Date.now())) {
      const lim = rt.bins
        .filter((b) => b.limitedUntil > Date.now())
        .map((b) => `${b.name}→${new Date(b.limitedUntil).toISOString()}`)
        .join(', ');
      process.stdout.write(`limited bins: ${lim}\n`);
    }
  } else {
    process.stdout.write(`runtime: (never run)\n`);
  }

  const st = loadState(cfg.paths.stateJson);
  const counts = Object.entries(st.tasks)
    .map(([t, v]) => `${t}=${v.round}`)
    .join('  ') || '(none yet)';
  process.stdout.write(`\nper-task rounds: ${counts}\n`);
  const recent = st.runs.slice(-8);
  if (recent.length) {
    process.stdout.write(`\nrecent runs:\n`);
    for (const r of recent) {
      process.stdout.write(
        `  ${r.task} r${r.round} a${r.attempt} [${r.bin ?? '-'}] ${r.outcome}` +
          `${r.costUsd != null ? ` $${r.costUsd}` : ''}${r.resetAt ? ` resets=${r.resetAt}` : ''}\n`,
      );
    }
  }
}
