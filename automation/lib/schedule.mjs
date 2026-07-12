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
import { join } from 'node:path';
import { AUTOMATION_ROOT } from './config.mjs';
import { loadState, readRuntime } from './state.mjs';

const LMAUTO = join(AUTOMATION_ROOT, 'lmauto.mjs');

function cronTag(name) {
  return `# lmthing-automation-${name}`;
}
function cronLine(cfg) {
  const log = cfg.paths.loopLog;
  return `0 */5 * * * cd ${AUTOMATION_ROOT} && node ${LMAUTO} loop ${cfg.name} >> ${log} 2>&1 ${cronTag(cfg.name)}`;
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

export function status(cfg) {
  const cron = readCrontab().find((l) => l.includes(cronTag(cfg.name)));
  process.stdout.write(`== instance: ${cfg.name} ==\n`);
  process.stdout.write(`cron: ${cron ?? '(none)'}\n\n`);

  const rt = existsSync(cfg.paths.runtime) ? readRuntime(cfg.paths.runtime) : null;
  if (rt) {
    process.stdout.write(
      `runtime: state=${rt.state} task=${rt.task} round=${rt.round} attempt=${rt.attempt ?? '-'} ` +
        `bin=${rt.activeBin ?? '-'} nextRunAt=${rt.nextRunAt ?? '-'} (pid ${rt.pid})\n`,
    );
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
