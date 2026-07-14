/**
 * `lmauto client` — manage the scenario-dashboard sync client (automation/client).
 *
 * The client runs on THIS machine and pushes campaign + scenario data to the
 * cluster dashboard (automation/app, served at https://lmthing.cloud/scenario-dash).
 * The cluster can't reach behind a home NAT, so the push is one-way from here.
 *
 *   lmauto client up      [--app-url URL] [--token TOK] [--instance NAME]
 *   lmauto client down
 *   lmauto client status
 *   lmauto client token                       # print the DASH_VIEW_TOKEN from the cluster
 *
 * Zero deps — Node built-ins + the devops cluster-kubectl.sh helper for the token.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './config.mjs';

const CLIENT_ENTRY = join(REPO_ROOT, 'automation/client/client.mjs');
const RUN_DIR = join(REPO_ROOT, 'automation/client/.run');
const PID_FILE = join(RUN_DIR, 'client.pid');
const LOG_FILE = join(RUN_DIR, 'client.log');
const DEFAULT_APP_URL = 'https://lmthing.cloud';
const DEFAULT_INSTANCE = 'scenario-campaign';

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid() {
  if (!existsSync(PID_FILE)) return null;
  const pid = Number(readFileSync(PID_FILE, 'utf8').trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

/** Fetch + decode DASH_VIEW_TOKEN from the cluster's lmthing-secrets. */
export function clusterToken() {
  const script = join(REPO_ROOT, 'devops/scripts/cluster-kubectl.sh');
  if (!existsSync(script)) throw new Error(`missing ${script} — cannot read the token from the cluster`);
  const b64 = execFileSync(
    script,
    ['get', 'secret', 'lmthing-secrets', '-n', 'lmthing', '-o', 'jsonpath={.data.DASH_VIEW_TOKEN}'],
    { encoding: 'utf8' },
  ).trim();
  if (!b64) throw new Error('DASH_VIEW_TOKEN is not set in lmthing-secrets (run `make deploy-secrets`)');
  return Buffer.from(b64, 'base64').toString('utf8').trim();
}

function resolveToken(flags) {
  if (flags.token) return String(flags.token);
  if (process.env.DASH_VIEW_TOKEN) return process.env.DASH_VIEW_TOKEN;
  return clusterToken();
}

export function clientCommand(action, flags = {}) {
  switch (action) {
    case 'token': {
      process.stdout.write(clusterToken() + '\n');
      return;
    }

    case 'up': {
      const existing = readPid();
      if (existing && isAlive(existing)) {
        process.stdout.write(`client already running (pid ${existing})\n  logs: ${LOG_FILE}\n`);
        return;
      }
      const appUrl = String(flags['app-url'] ?? DEFAULT_APP_URL);
      const instance = String(flags.instance ?? DEFAULT_INSTANCE);
      const token = resolveToken(flags);
      mkdirSync(RUN_DIR, { recursive: true });
      const out = openSync(LOG_FILE, 'a');
      const child = spawn(
        process.execPath,
        [CLIENT_ENTRY, '--app-url', appUrl, '--token', token, '--instance', instance],
        { detached: true, stdio: ['ignore', out, out] },
      );
      child.unref();
      writeFileSync(PID_FILE, String(child.pid));
      process.stdout.write(
        `client up (pid ${child.pid})\n  app: ${appUrl}\n  instance: ${instance}\n  logs: ${LOG_FILE}\n`,
      );
      return;
    }

    case 'down': {
      const pid = readPid();
      if (!pid || !isAlive(pid)) {
        if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
        process.stdout.write('client not running\n');
        return;
      }
      try {
        process.kill(pid);
      } catch {
        /* already gone */
      }
      if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
      process.stdout.write(`client down (pid ${pid})\n`);
      return;
    }

    case 'status': {
      const pid = readPid();
      if (pid && isAlive(pid)) {
        process.stdout.write(`client running (pid ${pid})\n  logs: ${LOG_FILE}\n`);
      } else {
        process.stdout.write('client not running\n');
      }
      return;
    }

    default:
      throw new Error(`unknown client action "${action}" — use up|down|status|token`);
  }
}
