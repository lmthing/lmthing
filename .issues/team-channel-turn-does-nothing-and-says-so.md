# Two consecutive channel turns did nothing — and the ACCEPTANCE turn added zero statements

**Symptom** (scenarios/21-newsroom run 1, steps 1–2, 2026-07-31): the opening exchange of a scenario
produced no work and no answer, twice, and the newspaper never got its story tracker. Everything
downstream (steps 5, 7, 8 — the scheduled brief, the added column, the app) is playing against an app
that does not exist.

The `#newsroom` log (`runs/1/data/.lmthing/.team/channels/newsroom.jsonl`):

```
03:04:53 user  pilar | @thing every Thursday I lose an afternoon just working out where everything is…
03:06:21 thing        | THING finished without posting an answer.
03:06:21 user  pilar | yes, do that. Nadia's never at a desk so it has to be readable on a phone.
03:06:40 thing        | THING finished without posting an answer.
```

("THING finished without posting an answer." is `renderResult`'s honest fallback — this is the
**correct** rendering of a turn that displayed nothing, and it is what the recent history-fallback
fix produces instead of dumping the agent's source. The rendering is right; the turn is wrong.)

## Step 1 — worked, then stopped without telling anyone

89 seconds, 2 statements (`runs/1/step-01.full.json`, `turns[0].wrote`):

```ts
setSessionMeta({ title: 'newsroom story tracker', slug: 'newsroom-stories' });
setActivity('Orienting — team context and project setup');
const ctx = await teamContext();
…
setActivity('Setting up the newsroom project');
const p = createProject('Alcalá Post Newsroom');
if (!p.ok) {
  display(<Callout variant="error" title="Could not create project">…</Callout>);
}
```

The project WAS created (`runs/1/data/.lmthing/alcal-post-newsroom/` exists). `display()` appears
only in the failure branch, so the success path displays nothing and the turn ends. Pilar asked for
help and was told the assistant finished without an answer.

Two separate faults in one turn: it **authored on the offer turn** (see
`.issues/thing-builds-on-the-offer-turn.md` — `createProject` is authoring, and this is another
occurrence), and the only path that speaks to the user is the error path.

## Step 2 — a complete no-op on "yes, do that"

19 seconds. From `runs/1/step-02.full.json`, `turns[0].wrote`:

```json
{ "statements": 0, "since": 2, "totalStatements": 2, "codeChars": 0 }
```

The session had 2 statements before the turn and 2 after: **the resumed turn added nothing at all**.
No delegates, no globals, no activity, no asks (`asks: []`, `consumedPendingAsk: false`, so it was
not swallowed as an answer to a parked question). The turn settled `done` and posted the fallback.

Consequence: `alcal-post-newsroom/` has **no `database/` directory** — the three stories Pilar named
were never created, and nothing was ever built. The scenario's step 2 expects ("the three stories
exist as real DB rows with their real owners", "THING says what they can open") fail outright, and
with them every later step that reads the app.

## What is worth checking first

- **The resume path.** Step 1 opened the thread; step 2 resumed the same session
  (`runHeadlessThreaded` → `session.resume(snapshotDir, message)`) and produced zero statements. A
  new thread in the same run works fine — step 3 (a fresh thread) ran 35s, wrote statements, and
  answered. The distinguishing factor is resume-vs-start, and the snapshot it resumed from is one
  written by a turn that ended without displaying anything.
- **The anti-silent guard.** `visibleToUser: true` is passed for every channel turn precisely so a
  turn that "did work and displayed nothing" is nudged rather than settling in silence. Two turns in
  a row settled in silence. Either the guard is not reaching this path or it nudged and nothing
  changed — worth instrumenting before assuming the model is at fault.

## Not the same as the code-dump defect

`.issues/team-channel-posts-agent-code-as-the-answer.md` is about a turn that DID work and whose
output was rendered as source. This is the opposite: the rendering is correct and there is no work to
render. Both produce a useless channel message, from opposite causes.

## Verify a fix

Play 21-newsroom steps 1–2. Step 1 must end with a proposal and a question (and, per the restraint
issue, author nothing). Step 2 must produce a table with three story rows and a sentence naming what
the team can open. Assert on `wrote.statements > 0` for the resumed turn — a turn that adds no
statements to its session is the signature here, and it is invisible in the reply text alone.
