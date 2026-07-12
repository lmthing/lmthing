/**
 * runner.mjs — one `claude -p` invocation (an "attempt").
 *
 * Spawns the given claude bin in headless stream-json mode, tees the raw JSONL + a distilled
 * human log + a result.json into the attempt dir, live-tracks session id / usage / activity for
 * the TUI, and detects a usage-limit hit (plus its "resets at" time). Exposes pause/resume/stop
 * as OS signals on the child so a long pause can escalate to kill-and-resume.
 *
 * The caller (loop.mjs) decides WHICH bin and whether this is a `--resume` (same bin as the
 * session) or a fresh continuation-prompt run (different bin) — the runner just receives the final
 * `promptText` and an optional `resumeSessionId`.
 *
 * Zero dependencies — Node built-ins only.
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const LIMIT_RE = /(usage|rate|session)\s+limit|limit\s+(reached|exceeded)|resets?\s+(at|on|in)|too many requests|error_max_budget/i;
const PROMPT_MARKER = '<see prompt.md>';

/** Build the exact claude argv for an attempt. */
export function buildArgv({ bin, promptText, cfg, resumeSessionId = null }) {
  const c = cfg.claude;
  return [
    bin,
    '-p',
    promptText,
    '--dangerously-skip-permissions',
    '--output-format',
    'stream-json',
    '--verbose',
    ...(resumeSessionId ? ['--resume', resumeSessionId] : []),
    ...(c.model ? ['--model', c.model] : []),
    ...c.addDirs.flatMap((d) => ['--add-dir', d]),
    ...c.flags,
  ];
}

/** The argv with the (huge, possibly sensitive) prompt elided — safe to persist. */
export function redactArgv(argv) {
  return argv.map((a, i) => (argv[i - 1] === '-p' ? PROMPT_MARKER : a));
}

/**
 * Parse a "resets at ..." style phrase into an epoch (ms), or null.
 * Handles ISO timestamps, "3pm"/"3:30 PM"/"15:00", and "in N minutes/hours".
 */
export function parseResetAt(text, now = Date.now()) {
  if (!text) return null;

  const iso = text.match(/resets?\s+(?:at|on)\s+(\d{4}-\d{2}-\d{2}[T ][\d:.]+Z?)/i);
  if (iso) {
    const t = Date.parse(iso[1].replace(' ', 'T'));
    if (!Number.isNaN(t)) return t;
  }

  const rel = text.match(/resets?\s+in\s+(\d+)\s*(min(?:ute)?s?|hours?|h|m)\b/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const ms = unit.startsWith('h') ? n * 3600e3 : n * 60e3;
    return now + ms;
  }

  const clock = text.match(/resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (clock) {
    let hh = Number(clock[1]);
    const mm = clock[2] ? Number(clock[2]) : 0;
    const ap = clock[3]?.toLowerCase();
    if (ap === 'pm' && hh < 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    const d = new Date(now);
    d.setHours(hh, mm, 0, 0);
    let t = d.getTime();
    if (t <= now) t += 24 * 3600e3; // already past today → next day
    return t;
  }
  return null;
}

/** Seed a PROGRESS.md for a (round, task) — only if absent, so it persists across attempts. */
export function seedProgress(progressFile, { instance, task, round }) {
  mkdirSync(dirname(progressFile), { recursive: true });
  if (existsSync(progressFile)) return;
  const header = `# PROGRESS — ${instance} · task \`${task}\` · round ${round}

_Started ${new Date().toISOString()}. The agent MUST update this file at every step._

## Steps

<!-- append one bullet per step: what you did -->

## Files added to context

<!-- append every file you had to read / add to your context, with why -->
`;
  writeFileSync(progressFile, header, 'utf8');
}

/**
 * Start one attempt. Returns a controller:
 *   { child, live, settled(), result(), pause(), resume(), stop(), skip(), done }
 * `done` resolves to the result object once the child exits.
 */
export function startRun({ bin, promptText, cfg, attemptDir, resumeSessionId = null, thresholdMs }) {
  mkdirSync(attemptDir, { recursive: true });
  const argv = buildArgv({ bin, promptText, cfg, resumeSessionId });

  // Persist the exact prompt + (redacted) argv before spawning.
  writeFileSync(join(attemptDir, 'prompt.md'), promptText, 'utf8');
  writeFileSync(join(attemptDir, 'argv.txt'), redactArgv(argv).join(' \\\n  ') + '\n', 'utf8');

  const jsonlOut = createWriteStream(join(attemptDir, 'output.jsonl'), { flags: 'a' });
  const logOut = createWriteStream(join(attemptDir, 'output.log'), { flags: 'a' });

  const live = { bin, sessionId: resumeSessionId, activity: '', tool: '', usage: null, costUsd: null };
  const textBuf = [];
  let finalResult = null; // the {type:'result'} event, if any
  let intent = null; // 'stop' | 'skip' | 'relaunch' (set by control actions)
  let paused = false;
  let pausedAt = 0;

  const startedAt = new Date().toISOString();
  const child = spawn(argv[0], argv.slice(1), { cwd: cfg.cwd, env: process.env });

  const rl = createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    jsonlOut.write(line + '\n');
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      textBuf.push(line);
      return;
    }
    if (obj.session_id) live.sessionId = obj.session_id;

    if (obj.type === 'system' && obj.subtype === 'init') {
      logOut.write(`[init] session=${obj.session_id} model=${obj.model ?? ''}\n`);
    } else if (obj.type === 'assistant' && obj.message?.content) {
      for (const block of obj.message.content) {
        if (block.type === 'text' && block.text) {
          const t = block.text.trim();
          textBuf.push(t);
          live.activity = t.slice(-240);
          logOut.write(`[assistant] ${t.slice(0, 500)}\n`);
        } else if (block.type === 'tool_use') {
          live.tool = block.name || '';
          logOut.write(`[tool] ${block.name}\n`);
        }
      }
    } else if (obj.type === 'result') {
      finalResult = obj;
      if (obj.usage) live.usage = obj.usage;
      if (typeof obj.total_cost_usd === 'number') live.costUsd = obj.total_cost_usd;
      if (typeof obj.result === 'string') textBuf.push(obj.result);
      logOut.write(`[result] subtype=${obj.subtype} is_error=${obj.is_error} cost=${obj.total_cost_usd}\n`);
    }
  });

  child.stderr.on('data', (d) => {
    const s = d.toString();
    textBuf.push(s);
    logOut.write(`[stderr] ${s}`);
  });

  const done = new Promise((resolvePromise) => {
    child.on('close', (code) => {
      rl.close();
      jsonlOut.end();
      const joined = textBuf.join('\n');
      const limitHit =
        (finalResult && /limit|budget/i.test(finalResult.subtype || '')) ||
        (finalResult?.is_error && LIMIT_RE.test(joined)) ||
        (code !== 0 && LIMIT_RE.test(joined));

      let outcome;
      if (intent) outcome = 'interrupted';
      else if (limitHit) outcome = 'limit';
      else if (code === 0 && !finalResult?.is_error) outcome = 'done';
      else outcome = 'error';

      const result = {
        bin,
        attempt: null, // filled by caller
        sessionId: live.sessionId,
        model: cfg.claude.model,
        outcome,
        intent,
        subtype: finalResult?.subtype ?? null,
        isError: !!finalResult?.is_error,
        usage: live.usage,
        costUsd: live.costUsd,
        exitCode: code,
        resetAt: outcome === 'limit' ? parseResetAt(joined) : null,
        startedAt,
        endedAt: new Date().toISOString(),
      };
      logOut.write(`[exit] code=${code} outcome=${outcome}\n`);
      logOut.end();
      writeFileSync(join(attemptDir, 'result.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
      ctrl.result = result;
      ctrl.settledFlag = true;
      resolvePromise(result);
    });
  });

  const ctrl = {
    child,
    live,
    argv,
    result: null,
    settledFlag: false,
    settled() {
      return ctrl.settledFlag;
    },
    pause() {
      if (paused || ctrl.settledFlag) return;
      try {
        child.kill('SIGSTOP');
        paused = true;
        pausedAt = Date.now();
      } catch {
        /* ignore */
      }
    },
    /** Returns {relaunch:boolean}: true when the pause was too long and we killed for a resume. */
    resume() {
      if (!paused || ctrl.settledFlag) return { relaunch: false };
      const longPause = Date.now() - pausedAt >= thresholdMs;
      paused = false;
      if (longPause) {
        intent = 'relaunch';
        try {
          child.kill('SIGCONT'); // must un-stop before SIGKILL can be delivered
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
        return { relaunch: true };
      }
      try {
        child.kill('SIGCONT');
      } catch {
        /* ignore */
      }
      return { relaunch: false };
    },
    stop() {
      intent = 'stop';
      hardKill(child, paused);
    },
    skip() {
      intent = 'skip';
      hardKill(child, paused);
    },
    done,
  };
  return ctrl;
}

function hardKill(child, paused) {
  try {
    if (paused) child.kill('SIGCONT');
    child.kill('SIGKILL');
  } catch {
    /* ignore */
  }
}
