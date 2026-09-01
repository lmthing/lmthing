#!/usr/bin/env node
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { McpSpaceServer } from './server/index.ts';

export interface CliOptions { spacesDir: string; agent?: string; }

export function parseArgs(argv: string[]): CliOptions {
  let spacesDir: string | undefined;
  let agent: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--spaces-dir') {
      const value = argv[++index];
      if (!value) throw new Error('--spaces-dir requires a directory path');
      spacesDir = resolve(value);
    } else if (arg === '--agent') {
      const value = argv[++index];
      if (!value) throw new Error('--agent requires <spaceId>/<slug>');
      agent = value;
    } else if (arg === '--help' || arg === '-h') {
      throw new Error('Usage: mcp-space --spaces-dir <dir> [--agent <spaceId>/<slug>]');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!spacesDir) throw new Error('Missing required --spaces-dir <dir>');
  return agent === undefined ? { spacesDir } : { spacesDir, agent };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  let details;
  try { details = await stat(options.spacesDir); } catch { throw new Error(`--spaces-dir is not a directory: ${options.spacesDir}`); }
  if (!details.isDirectory()) throw new Error(`--spaces-dir is not a directory: ${options.spacesDir}`);
  const app = new McpSpaceServer({ spacesDir: options.spacesDir });
  await app.initialize();
  if (options.agent) await app.ctx.setActiveAgent(options.agent);
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
