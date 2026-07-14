#!/usr/bin/env node
/**
 * lmauto — a generic engine for recurring autonomous Claude Code sessions.
 *
 * An "instance" is a config folder under automation/instances/<name>/. The engine round-robins a
 * task list (each task gets its OWN per-task round), runs one `claude -p` session per task, records
 * a git-committed ledger + per-run artifacts, and survives usage limits (rotate to a backup bin, or
 * wait for reset and resume). See automation/README.md for how to author a new instance.
 *
 *   lmauto tui <instance> [task] [--attach] [--start-delay=SEC]
 *   lmauto run <instance> [task] [--dry-run] [--start-delay=SEC]
 *   lmauto loop <instance> [--interval=SEC] [--start-delay=SEC]
 *   lmauto supervise <instance> [--start-delay=SEC] [--duration=SEC] [--interval=SEC]
 *   lmauto schedule <instance> cron-install|cron-remove|status
 *   lmauto pause|continue|skip|stop <instance>
 *   lmauto status <instance>
 *   lmauto new <name>
 *   lmauto list
 *
 * Zero dependencies — Node built-ins only.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, instancePaths, listInstances, INSTANCES_DIR } from './lib/config.mjs';
import { loadState, writeControl } from './lib/state.mjs';
import { runLoop } from './lib/loop.mjs';
import { runTui } from './lib/tui.mjs';
import { supervise } from './lib/supervise.mjs';
import { cronInstall, cronRemove, watchInstall, watchRemove, status as scheduleStatus } from './lib/schedule.mjs';
import { ensureLoop } from './lib/supervisor.mjs';
import { clientCommand } from './lib/client.mjs';

function parse(argv) {
  const positionals = [];
  const flags = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      flags[k] = v === undefined ? true : v;
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

function die(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

const USAGE = `lmauto — recurring autonomous Claude sessions

  lmauto tui <instance> [task] [--attach] [--start-delay=SEC] [--parallel=N]
  lmauto run <instance> [task] [--dry-run] [--start-delay=SEC]
  lmauto loop <instance> [--interval=SEC] [--start-delay=SEC] [--parallel=N]
  lmauto supervise <instance> [--start-delay=SEC] [--duration=SEC] [--interval=SEC] [--parallel=N]
  lmauto schedule <instance> cron-install|cron-remove|watch-install|watch-remove|status
  lmauto ensure <instance>                     # restart the loop iff it has died (idempotent; for cron)
  lmauto pause|continue|skip|stop <instance> [task|slot#]
  lmauto status <instance>
  lmauto client up|down|status|token [--app-url URL] [--token TOK] [--instance NAME]
  lmauto new <name>
  lmauto list
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { positionals, flags } = parse(rest);
  const num = (v, d) => (v == null ? d : Number(v));

  switch (cmd) {
    case 'list': {
      const names = listInstances();
      if (!names.length) {
        process.stdout.write('(no instances — create one under automation/instances/, e.g. `lmauto new my-job`)\n');
        return;
      }
      for (const name of names) {
        const p = instancePaths(name);
        const st = loadState(p.stateJson);
        const counts = Object.entries(st.tasks).map(([t, v]) => `${t}:${v.round}`).join(' ') || '(unrun)';
        process.stdout.write(`${name}  ${counts}\n`);
      }
      return;
    }

    case 'new': {
      const name = positionals[0] ?? die('usage: lmauto new <name>');
      const dest = join(INSTANCES_DIR, name);
      if (existsSync(dest)) die(`instance "${name}" already exists at ${dest}`);
      const template = join(INSTANCES_DIR, '_template');
      if (!existsSync(template)) die(`no scaffold at ${template}`);
      mkdirSync(INSTANCES_DIR, { recursive: true });
      cpSync(template, dest, { recursive: true });
      process.stdout.write(`created instance "${name}" at ${dest}\n  edit config.mjs + the prompt templates, then: lmauto run ${name} --dry-run\n`);
      return;
    }

    case 'pause':
    case 'continue':
    case 'skip':
    case 'stop': {
      const name = positionals[0] ?? die(`usage: lmauto ${cmd} <instance> [task|slot#]`);
      const p = instancePaths(name);
      if (!existsSync(p.dir)) die(`no instance "${name}"`);
      // With parallel slots a command may target ONE lane (by task id or slot number);
      // without a target it is broadcast to every live lane. `stop` is always global.
      const target = positionals[1] ?? null;
      writeControl(p.control, target ? `${cmd} ${target}` : cmd);
      process.stdout.write(`sent "${cmd}"${target ? ` (target: ${target})` : ''} to ${name}\n`);
      return;
    }

    case 'schedule': {
      const name = positionals[0] ?? die('usage: lmauto schedule <instance> cron-install|cron-remove|watch-install|watch-remove|status');
      const action = positionals[1] ?? 'status';
      const cfg = await loadConfig(name);
      if (action === 'cron-install') cronInstall(cfg);
      else if (action === 'cron-remove') cronRemove(cfg);
      else if (action === 'watch-install') watchInstall(cfg);
      else if (action === 'watch-remove') watchRemove(cfg);
      else if (action === 'status') scheduleStatus(cfg);
      else die(`unknown schedule action "${action}"`);
      return;
    }

    case 'client': {
      const action = positionals[0] ?? die('usage: lmauto client up|down|status|token');
      clientCommand(action, flags);
      return;
    }

    case 'ensure': {
      const name = positionals[0] ?? die('usage: lmauto ensure <instance>');
      const cfg = await loadConfig(name);
      ensureLoop(cfg); // idempotent: restarts the loop only if it has died
      return;
    }

    case 'status': {
      const name = positionals[0] ?? die('usage: lmauto status <instance>');
      const cfg = await loadConfig(name);
      scheduleStatus(cfg);
      return;
    }

    case 'run': {
      const name = positionals[0] ?? die('usage: lmauto run <instance> [task] [--dry-run]');
      const cfg = await loadConfig(name);
      await runLoop(cfg, {
        once: true,
        forcedTask: positionals[1] ?? null,
        dryRun: !!flags['dry-run'],
        startDelay: num(flags['start-delay'], undefined),
      });
      return;
    }

    case 'loop': {
      const name = positionals[0] ?? die('usage: lmauto loop <instance>');
      const cfg = await loadConfig(name);
      await runLoop(cfg, {
        interval: num(flags.interval, undefined),
        startDelay: num(flags['start-delay'], undefined),
        maxParallel: num(flags.parallel, undefined),
      });
      return;
    }

    case 'supervise': {
      const name = positionals[0] ?? die('usage: lmauto supervise <instance>');
      const cfg = await loadConfig(name);
      await supervise(cfg, {
        startDelay: num(flags['start-delay'], undefined),
        duration: num(flags.duration, undefined),
        interval: num(flags.interval, undefined),
        maxParallel: num(flags.parallel, undefined),
      });
      return;
    }

    case 'tui': {
      const name = positionals[0] ?? die('usage: lmauto tui <instance> [task] [--attach]');
      const cfg = await loadConfig(name);
      await runTui(cfg, {
        attach: !!flags.attach,
        forcedTask: positionals[1] ?? null,
        startDelay: num(flags['start-delay'], undefined),
        maxParallel: num(flags.parallel, undefined),
      });
      return;
    }

    case undefined:
    case '-h':
    case '--help':
      process.stdout.write(USAGE);
      return;

    default:
      die(`unknown command "${cmd}"\n\n${USAGE}`);
  }
}

main().catch((e) => die(e?.stack || e?.message || String(e)));
