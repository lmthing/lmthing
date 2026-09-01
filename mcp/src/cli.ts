#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { McpSpaceServer } from './server/index.ts';

/** The project a caller's writes land in when they name none. */
export const DEFAULT_PROJECT = 'default';
/** The per-cwd runtime root. Spaces live at `<root>/.lmthing/<project>/spaces/<spaceId>/`. */
export const RUNTIME_DIR = '.lmthing';

export interface CliOptions {
  /** `<root>/.lmthing` — the whole runtime, every project beneath it. */
  runtimeDir: string;
  /** Default project for writes; does NOT limit what is loaded. */
  project: string;
  agent?: string;
}

/**
 * ONE server serves the ENTIRE runtime root.
 *
 * `--project` is only the default target for authoring — every project under `.lmthing/` is
 * loaded and reachable regardless, because a harness must be able to move between projects
 * without the server being restarted or repointed. `--runtime-dir` overrides the location
 * outright, which is what the test fixtures use.
 */
export function parseArgs(argv: string[]): CliOptions {
  let runtimeDir: string | undefined;
  let project = DEFAULT_PROJECT;
  let root = process.cwd();
  let agent: string | undefined;
  const need = (value: string | undefined, flag: string): string => {
    if (!value) throw new Error(`${flag} requires a value`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--runtime-dir') runtimeDir = resolve(need(argv[++index], '--runtime-dir'));
    else if (arg === '--root') root = resolve(need(argv[++index], '--root'));
    else if (arg === '--project') project = need(argv[++index], '--project');
    else if (arg === '--agent') agent = need(argv[++index], '--agent');
    else if (arg === '--help' || arg === '-h') {
      throw new Error(
        'Usage: mcp-space [--root <dir>] [--project <id>] [--agent <project>/<space>/<slug>]\n' +
        `  Serves EVERY project under <root>/${RUNTIME_DIR}/ ; --project only sets the default\n` +
        `  target for writes (default "${DEFAULT_PROJECT}").\n` +
        '  --runtime-dir <dir>  use this directory as the runtime root directly.',
      );
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (isAbsolute(project) || /[\\/]/.test(project) || project === '.' || project === '..') {
    throw new Error(`--project must be a single path segment, got: ${project}`);
  }
  const dir = runtimeDir ?? join(root, RUNTIME_DIR);
  return agent === undefined ? { runtimeDir: dir, project } : { runtimeDir: dir, project, agent };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  // A fresh cwd has no .lmthing/ yet. Create the runtime root and the default project's spaces
  // dir rather than refusing to start — there is nothing to fail loudly about, and an MCP client
  // reports a non-start as an opaque "server failed to start".
  await mkdir(join(options.runtimeDir, options.project, 'spaces'), { recursive: true });
  const app = new McpSpaceServer({ runtimeDir: options.runtimeDir, defaultProject: options.project });
  await app.initialize();
  if (options.agent) {
    // A bad --agent must not stop the server booting: a running server whose get_active_agent
    // returns null is far easier to diagnose than a client saying only "failed to start".
    try {
      await app.ctx.setActiveAgent(options.agent);
    } catch (error: unknown) {
      process.stderr.write(`[mcp-space] --agent ${options.agent} not selected: ` +
        `${error instanceof Error ? error.message : String(error)}\n` +
        `[mcp-space] starting with no active agent; use list_agents then set_agent.\n`);
    }
  }
  await app.connectStdio();
}

/**
 * Run the server, reporting a startup failure on stderr.
 *
 * Exported because `bin/mcp-space.mjs` imports and calls it. It used to self-start behind an
 * `import.meta.url === argv[1]` guard, which silently did NOTHING once the launcher imported
 * this module — argv[1] was then the launcher, the guard was false, `main()` never ran, and the
 * MCP client saw only "Connection closed" with no error anywhere.
 */
export async function run(): Promise<void> {
  try {
    await main();
  } catch (error: unknown) {
    process.stderr.write(`[mcp-space] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
