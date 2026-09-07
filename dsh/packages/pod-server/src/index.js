#!/usr/bin/env node
/**
 * Production compute-pod entrypoint (Part B1, see dsh/PROGRESS.md). Replaces
 * `lmthing serve` (the retired @lmthing/cli QuickJS runtime) as the compute
 * image's CMD. See src/proxy.js and src/profile-bootstrap.js for why this
 * wrapper is necessary at all (dsh refuses to bind 0.0.0.0, and ships no
 * health route).
 *
 * Exits with the child dsh process's own exit code (or on signal) so the
 * container exits too — there is no separate liveness probe (only a
 * startupProbe, deliberately — see compute.ts), so a dsh crash mid-session
 * only restarts the pod if THIS process also exits.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { bootstrapProfile } from './profile-bootstrap.js'
import { createPodServer } from './proxy.js'

const here = dirname(fileURLToPath(import.meta.url))
// This package ships at <dshRoot>/packages/pod-server/src/index.js.
const dshRoot = join(here, '..', '..', '..')
const dshBin = join(dshRoot, 'node_modules', '.bin', 'dsh')

const PORT = Number(process.env.PORT ?? 8080)
const DSH_INTERNAL_PORT = Number(process.env.DSH_INTERNAL_PORT ?? 38080)
const DSH_HOME = process.env.DSH_HOME ?? '/data/.dsh-home'

async function main() {
  const { patchPaths } = await bootstrapProfile({ dshRoot, dshHome: DSH_HOME })

  // --patch must precede --host/--port/--no-open — confirmed live: dsh's cmdline
  // parser rejects `--patch` placed after them ("error: unknown option '--patch'"),
  // matching the working order already used by scripts/run-web.sh's --real path.
  const args = ['--profile', 'lmthing-web']
  for (const p of patchPaths) args.push('--patch', p)
  args.push('--host', '127.0.0.1', '--port', String(DSH_INTERNAL_PORT), '--no-open')

  console.log(`[pod-server] starting dsh: ${dshBin} ${args.join(' ')}`)
  const child = spawn(dshBin, args, {
    cwd: dshRoot,
    stdio: 'inherit',
    env: { ...process.env, DSH_HOME },
  })

  let shuttingDown = false
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      shuttingDown = true
      child.kill(sig)
    })
  }

  child.on('exit', (code, signal) => {
    console.log(`[pod-server] dsh exited (code=${code}, signal=${signal})`)
    process.exit(shuttingDown ? 0 : (code ?? 1))
  })

  const server = createPodServer({ backendPort: DSH_INTERNAL_PORT })
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[pod-server] listening on 0.0.0.0:${PORT}, proxying to 127.0.0.1:${DSH_INTERNAL_PORT}`)
  })
}

main().catch((err) => {
  console.error('[pod-server] fatal error during startup', err)
  process.exit(1)
})
