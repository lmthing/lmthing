# cold-boot race: a fresh session's first message can 404 (session lost) on a heavy-preload project

**Symptom** (found 2026-07-20 while distilling the `new-topic-specialist` repro): a FRESH session
opened against a freshly-booted pod whose project is HEAVY (the seed carried all 8 specialist spaces
— tasklists+knowledge+agents each — plus a full built app: pages/api/components/types, ~1.5M total)
dies immediately: the client's first events poll after `POST /message` gets a **404 (session
unknown)** before a single trace event streams. 3/3 runs on the heavy seed; **0/N on a shrunk seed**
(3 spaces + `database/` only, no app, ~492K). The session vanishes from the pod's session-manager
registry between creation/first-message and the first poll, with zero work done.

**Diagnosis:**
- Server stdout (`sessions.log`) is CLEAN for every failed run — "Multi-session server ready", no
  exception, no error line. So it is NOT a seed-data crash (a broken space/db load would log).
- The throw is client-side at `sdk/org/scenarios/harness/lib/thing.mjs:394` (`!sawWork` branch of
  `#dispatchAndWait`) — a real 404, not a harness assertion.
- Most likely a **boot-time race under heavy per-project preload**: the "Faster cold-wake" work
  deferred the boot block into a NON-AWAITED background task (see memory: root a616e250 / sdk/org
  16938c1 — "deferred the whole boot block into a non-awaited bg task + setImmediate yield between
  db-warm projects"). For a project this heavy, a fresh session's creation/first-message can race
  ahead of that deferred task, and the session is lost/reaped before it registers.
- **Distinct from `session-resume-machinery`** (that is `resume()` on a huge prior history; this is a
  FRESH session, no resume). Distinct from the run-9/28 reaper-idle case too.

**Why it matters:** this is a real cold-pod reliability risk — a genuine user whose project has grown
heavy (many spaces + a built app) could lose their FIRST message after a cold wake, exactly the moment
the "instant wake" work was meant to make reliable.

**Open question before fixing:** confirm whether this reproduces against a real cold pod (not only the
scenario harness's eager first-poll timing) — i.e. is the session genuinely lost pod-side, or does the
harness poll `/events` before the pod has committed the session? A pod-side repro (curl `POST /message`
then immediately `GET /events` on a cold heavy project) would settle it.

**Where:** `sdk/org/libs/cli/src/server/session-manager.ts` (session registration vs the deferred boot
task), the cold-wake boot sequencing (runtime-init / the non-awaited boot task), and possibly the
first-message path. Compare with `sdk/org/scenarios/harness/lib/thing.mjs:394`'s poll timing.

**Evidence:** the `new-topic-specialist` repro runs 1-3 (heavy seed) — client 404 at thing.mjs:394,
clean server stdout; the shrunk-seed re-run (492K) is the control. Related memory: "Faster cold-wake".
Filed 2026-07-20.
