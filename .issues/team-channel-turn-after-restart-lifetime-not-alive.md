# First channel turn after a pod restart died with "Lifetime not alive"

**Symptom** (scenarios/21-newsroom run 1 step 10, 2026-07-31): the pod was restarted, then Nadia
asked in `#newsroom` — *"@thing donde estamos para el jueves?"*. After 32 seconds the channel
received, as a `system` message:

> **THING could not answer: Lifetime not alive**

`runs/1/step-10.json` (`turns[0].status: "error"`), and the message is in
`runs/1/data/.lmthing/.team/channels/newsroom.jsonl`.

## What the string means

`"Lifetime not alive"` is QuickJS's error for an operation on a DISPOSED handle. The runtime already
knows this failure mode by name:

- `libs/core/src/sandbox/quickjs.ts:33` — *"'Lifetime not alive' from a resume op on a disposed
  handle"*; also `:107`, `:123`, `:187`, `:216`
- `libs/core/src/sandbox/trace.ts:95` and `libs/cli/src/server/session-manager.ts:1788` — *"…that
  turn's resume throws the opaque QuickJS 'Lifetime not alive'"*

So a channel turn resumed a thread session against a VM that had already been disposed. The thread's
persisted snapshot is on disk and survives the restart; what does not survive is whatever in-process
handle the resume reached for.

## Why it matters more on the team surface

`runHeadlessThreaded` is the only path a team channel turn takes, and a thread is LONG-LIVED by
design — the whole point is that the conversation continues across days, members and pod restarts
(a team pod scales to zero, so restarts are the normal case, not an edge one). The failure is also
terminal for that thread's turn: the member gets an internal error string with no recovery and no
suggestion to retry.

## It is intermittent

The same `restart_pod` beat in 20-studio run 2 step 11 worked: 33 seconds, a real answer, and the
project/rows/channels all survived. So this is a race or a state-dependent disposal, not a
deterministic break of the restart path. 21-newsroom's step 10 differs in that its thread was
brand-new (opened by the same step, after the restart) — worth checking whether the failing case is
a session created and resumed within the boot window.

## Evidence

- `sdk/org/scenarios/21-newsroom/runs/1/step-10.{json,full.json}` — the failed turn
- `sdk/org/scenarios/21-newsroom/runs/1/sessions.log` — the server's own output across the restart
- Contrast: `sdk/org/scenarios/20-studio/runs/2/step-11.json` — the same verb, succeeding

## Verify a fix

Play a `restart_pod` step followed immediately by a channel message, repeatedly. Every turn must
either answer or fail with something a member can act on — never a sandbox-internal string. A
`system` message quoting a QuickJS lifetime error is the signature.
