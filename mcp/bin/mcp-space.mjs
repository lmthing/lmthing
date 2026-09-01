#!/usr/bin/env node
/**
 * A `.mjs` launcher rather than pointing straight at `src/cli.ts`, for one reason:
 *
 * Node below 24 cannot PARSE a `.ts` file at all. It fails with
 * `ERR_UNKNOWN_FILE_EXTENSION ".ts"` before a single line of our code runs, and an MCP client
 * surfaces that only as "server failed to start" — with no hint that the Node version is the
 * problem. This file parses on every Node ever shipped, so the check below can actually report it.
 *
 * The common way to hit this even with a modern shell: an MCP client launched from a desktop
 * environment inherits a different PATH than your terminal.
 */
const major = Number(process.versions.node.split('.')[0]);
if (major < 24) {
  process.stderr.write(
    `[mcp-space] requires Node >= 24 — running ${process.versions.node} (${process.execPath}).\n` +
    `This server runs directly from TypeScript source via Node's native type stripping, so an\n` +
    `older Node cannot load it at all.\n` +
    `If your shell has Node 24 but this still failed, the MCP client was launched with a\n` +
    `different PATH: put an absolute path to node in "command" in .mcp.json.\n`,
  );
  process.exit(1);
}
const { run } = await import('../src/cli.ts');
await run();
