# A team channel showed compiler errors, the agent's own source, and a memory dump

**Found:** 2026-07-31, `20-studio` run 2 (`sdk/org/scenarios/20-studio/runs/2/`). Two distinct
leaks, both of which a member of Fold Studio would read as the product being broken.

## 1. A failed turn posted its ERROR and its source into the channel

Step 3 — Bo's reply in Ana's thread — reported `status: done` and posted this as THING's answer in
`#studio` (`data/.lmthing/.team/channels/studio.jsonl`, `blocks: null`):

```
ERROR (attempt 3 of 3)
// // `apiCall` needs 2 args — the route name and an optional input. Let me pass undefined as the second arg.
// const listResult = await apiCall('jobs-list/GET', undefined);
// No overload matches this call.
  The last overload gave the following error.
    Argument of type '"jobs-list/GET"' is not assignable to parameter of type '"update-job-status"'.

// Still in scope from earlier successful statements (do NOT redeclare): app2, jobsAfter

// ALREADY EXECUTED (do not repeat — fix the failing statement and continue from there):
…
setActivity('Rebuilding with the appbuilder — full features, no broken endpoints');
const app2 = await delegate('system-appbuilder', 'automator', 'build_live_project', { … });
```

TypeScript overload diagnostics, the retry scaffolding, and the agent's own delegate call, posted
into a channel four colleagues read.

This is a **different mechanism** from the fixed one. `runHeadless`'s fallback to the last history
entry was removed (a turn with no display returns `undefined`), and that fix holds — this turn DID
display something, and what it displayed was its own error report. So the reply path is behaving
correctly and the content it was handed is the problem.

Note also `status: done`. From the outside the turn succeeded.

**What a person should see:** that THING could not complete the change, in one sentence, with the
thread left in a state the next message can continue from. Not a compiler transcript. The channel
already has a `system`-kind message shape for exactly this.

## 2. The memory system's output was rendered as the answer

Step 4's reply in `#press` opens:

```
All remembered facts
3 facts found
response-style: Prefers answers in bullet points with sources.
answer-format: bullet-points-with-sources
answer-format-preference: Prefers answers in bullet points with sources.

I've checked the #press channel history and our project memory, …
```

The `user-memory/memory` delegate's raw listing is prepended to the real answer. THING's instruct
says the opposite for delegate results — *"Read `auto` yourself, then tell them what they can now
open, in a sentence. Never dump it."*

Worth noting the three "facts" are three near-duplicate spellings of one preference, which is a
separate smell in whatever wrote them.

## Why both matter more in a channel than in `/chat`

In `/chat` an ugly turn is seen by the one person who caused it and scrolls away. A channel is
**shared and permanent**: it is read by colleagues who did not ask, it is the record scrolled back
through later, and it is what a notification quotes. Every one of these was addressed to a member by
`mentions`, so it also went out as a push.

## Repro

```bash
cd sdk/org
node scenarios/run-team-scenario.mjs 20-studio --through 4
```

Then read `runs/<n>/data/.lmthing/.team/channels/*.jsonl`. Stochastic — the error path needs a turn
that actually fails three times, so verify over N runs.

## Related

- `design/teams-ux-audit.md` — B3 confirmed the `blocks` path is sound; this is about what is handed
  to it. A5 covers how a failure is *drawn* (tiny centred italic grey, identical to "app is ready").
- `.issues/thing-switches-builders-against-a-stated-requirement.md` — the same step 3.
