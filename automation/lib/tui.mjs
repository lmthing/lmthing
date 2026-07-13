/**
 * tui.mjs — a zero-dependency terminal dashboard for an instance.
 *
 * `renderFrame(runtime, {cols})` is a PURE function returning the full ANSI frame (so it can be
 * unit-tested without a TTY). The driver reads state/runtime.json on a timer, repaints, and maps
 * keypresses to control commands (written to the same state/control channel the loop polls), so it
 * works whether it launched the loop in-process or attached to one already running under cron/nohup.
 *
 * Zero dependencies — Node built-ins only.
 */
import { runLoop } from './loop.mjs';
import { readRuntime, writeControl } from './state.mjs';

const ESC = '\x1b[';
const c = {
  reset: `${ESC}0m`,
  dim: `${ESC}2m`,
  bold: `${ESC}1m`,
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  blue: `${ESC}34m`,
  cyan: `${ESC}36m`,
  gray: `${ESC}90m`,
};

const STATE_COLOR = {
  running: c.green,
  paused: c.yellow,
  'waiting-for-reset': c.red,
  'waiting-for-start': c.cyan,
  sleeping: c.blue,
  idle: c.gray,
  stopped: c.gray,
};

function fmtCountdown(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h${m}m` : m > 0 ? `${m}m${sec}s` : `${sec}s`;
}

function bar(cols, ch = '─') {
  return c.gray + ch.repeat(Math.max(1, cols)) + c.reset;
}

/** One lane: its task, round/attempt, bin, cost, and what it's doing right now. */
function renderSlot(s, w) {
  const stateC = STATE_COLOR[s.state] ?? c.reset;
  const lines = [];
  const head =
    `${c.gray}[${s.slot}]${c.reset} ${c.bold}${(s.task ?? '—').padEnd(20)}${c.reset}` +
    ` ${c.dim}r${c.reset}${s.round ?? '-'} ${c.dim}a${c.reset}${s.attempt ?? '-'}` +
    `  ${stateC}${s.state}${c.reset}  ${c.dim}${s.activeBin ?? ''}${c.reset}`;
  const lr = s.lastResult;
  const bits = [];
  if (lr?.outcome) bits.push(`outcome=${lr.outcome}`);
  if (lr?.costUsd != null) bits.push(`$${lr.costUsd}`);
  if (lr?.usage?.output_tokens != null) bits.push(`out=${lr.usage.output_tokens}tok`);
  if (lr?.tool) bits.push(`tool=${lr.tool}`);
  lines.push(head + (bits.length ? `  ${c.dim}${bits.join(' ')}${c.reset}` : ''));

  if (s.state === 'sleeping' || s.state === 'waiting-for-start') {
    const label = s.state === 'waiting-for-start' ? 'first run' : 'next run';
    lines.push(`    ${c.dim}${label} in${c.reset} ${fmtCountdown(s.readyAt)}`);
  } else if (s.state === 'waiting-for-reset' && s.limit?.resetAt) {
    lines.push(`    ${c.red}⚠ usage limit — resume in ${fmtCountdown(s.limit.resetAt)}${c.reset}`);
  } else if (lr?.activity) {
    lines.push(`    ${c.dim}▸${c.reset} ${String(lr.activity).replace(/\s+/g, ' ').slice(0, w - 6)}`);
  }
  return lines;
}

/** Build the full dashboard frame as a string. Pure — no I/O. */
export function renderFrame(rt, { cols = 80 } = {}) {
  if (!rt) return `${c.gray}(no runtime state yet — instance has not started)${c.reset}\n`;
  const w = Math.max(40, cols);
  const lines = [];
  const stateC = STATE_COLOR[rt.state] ?? c.reset;
  const slots = Array.isArray(rt.slots) ? rt.slots : [];
  const busy = slots.filter((s) => s.state === 'running' || s.state === 'paused').length;

  // Header
  lines.push(
    `${c.bold}${c.cyan}⟳ ${rt.instance}${c.reset}  ${stateC}${c.bold}${rt.state}${c.reset}` +
      `  ${c.dim}branch:${c.reset} ${rt.branch ?? '-'}  ${c.dim}pid:${c.reset} ${rt.pid ?? '-'}` +
      `  ${c.dim}parallel:${c.reset} ${busy}/${rt.maxParallel ?? 1}` +
      `  ${c.dim}tasks:${c.reset} ${rt.taskCount ?? '?'}`,
  );

  // Bins
  if (Array.isArray(rt.bins) && rt.bins.length) {
    const parts = rt.bins.map((b) =>
      b.limitedUntil > Date.now()
        ? `${c.red}${b.name}✗ ${fmtCountdown(new Date(b.limitedUntil).toISOString())}${c.reset}`
        : `${c.green}${b.name}✓${c.reset}`,
    );
    lines.push(`${c.dim}bins:${c.reset} ${parts.join('  ')}`);
  }
  lines.push(bar(w));

  // One block per lane
  if (!slots.length) lines.push(`${c.gray}(no slots)${c.reset}`);
  for (const s of slots) lines.push(...renderSlot(s, w));

  lines.push(bar(w));
  lines.push(
    `${c.dim}keys:${c.reset} ${c.bold}p${c.reset}ause ${c.bold}c${c.reset}ontinue ${c.bold}s${c.reset}kip ${c.bold}q${c.reset}uit` +
      `   ${c.gray}(skip/pause a single lane: lmauto skip <instance> <task|slot#>)${c.reset}`,
  );
  return lines.join('\n') + '\n';
}

/** Run the interactive dashboard. If !attach, launches the loop in-process. */
export async function runTui(cfg, opts = {}) {
  const paths = cfg.paths;
  const attach = !!opts.attach;
  const out = process.stdout;
  const isTty = out.isTTY;

  const enter = () => isTty && out.write(`${ESC}?1049h${ESC}?25l`); // alt screen, hide cursor
  const leave = () => isTty && out.write(`${ESC}?25h${ESC}?1049l`); // show cursor, main screen

  const paint = () => {
    const rt = readRuntime(paths.runtime, null);
    const frame = renderFrame(rt, { cols: out.columns ?? 80 });
    if (isTty) out.write(`${ESC}H${ESC}2J${frame}`); // home + clear + frame
    else out.write(frame + '\n');
  };

  let stopping = false;
  const cleanup = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    if (isTty && process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    leave();
  };

  enter();
  const timer = setInterval(paint, 500);
  paint();

  // Keys → control channel.
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (key) => {
      const k = key.toLowerCase();
      if (k === 'p') writeControl(paths.control, 'pause');
      else if (k === 'c') writeControl(paths.control, 'continue');
      else if (k === 's') writeControl(paths.control, 'skip');
      else if (k === 'q' || key === '\x03') {
        if (!attach) writeControl(paths.control, 'stop'); // owner quit → stop the loop it started
        cleanup();
        if (attach) process.exit(0);
      }
    });
  }
  process.on('SIGINT', () => {
    if (!attach) writeControl(paths.control, 'stop');
    cleanup();
    process.exit(0);
  });

  if (attach) {
    // Passive viewer: just keep painting until the user quits.
    await new Promise(() => {});
  } else {
    try {
      await runLoop(cfg, {
        startDelay: opts.startDelay,
        forcedTask: opts.forcedTask,
        maxParallel: opts.maxParallel,
      });
    } finally {
      paint();
      cleanup();
    }
  }
}
