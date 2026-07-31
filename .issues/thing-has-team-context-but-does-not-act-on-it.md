# THING reads the team context and then ignores it: no permission answer for a viewer, wrong channel for a cross-post

**Found in** scenarios/20-studio run 2 (2026-07-31), steps 9 and 5. Evidence:
`sdk/org/scenarios/20-studio/runs/2/step-{05,09}.{json,full.json}` and
`runs/2/data/.lmthing/.team/channels/{studio,press}.jsonl`.

The team globals themselves WORK and are reached for — `teamContext` in 6 of 11 turns,
`teamMembers`/`teamHistory` in step 4, `teamChannels` in steps 10–11, `teamPost` in step 5. This is
not a plumbing problem. It is that having the facts changed nothing about what THING did.

## 1. A viewer's write request gets neither the write nor an answer (step 9)

Rita is a `viewer`. She asked: *"@thing morning — can you mark the Trindade job as invoiced? I've
just sent it."*

What THING wrote (`step-09.full.json`, `turns[0].wrote.code`):

```ts
setSessionMeta({ title: 'Mark Trindade job as invoiced', slug: 'mark-trindade-invoiced' });
setActivity('Looking up the Trindade job');
const tables = db.tables();
const ctx = await teamContext();          // ← the caller's role is IN here
setActivity('Finding the Trindade job');
const allTables = db.tables();
display(allTables);                        // ← and this is the whole answer
```

What Rita received in `#studio`, as a `thing` message: **`jobs press_checks`** — the two table
names. The turn settled `done` in 5 seconds.

- The write did NOT happen — Trindade Bakery is still `ready for print` in `step-09.full.json`'s
  `state.appTables.jobs`. Good outcome, wrong reason: nothing refused it, the turn simply fizzled.
- `teamContext()` WAS called, so the role was available and unused. There is no evidence THING
  consulted `ctx.role` at all.
- Rita was told nothing. The scenario's expect — *"Rita gets an honest permission answer that names
  what she can do instead (ask an editor) — not silence, and not a fabricated 'done!'"* — fails on
  every clause: no refusal, no explanation, no offer of an alternative.

Note what is NOT the problem: `team-guard` correctly permits a viewer to POST A MESSAGE (talking is
a viewer's right), so there is no HTTP refusal to make here. The refusal has to come from THING
deciding, from the role it already fetched, that it will not write on her behalf — and saying so.

## 2. "Let the others know" posts into the channel it was already in (step 5)

Cai, in `#press`, having just told THING about a colour problem: *"can you let the others know? I'm
going to be stuck here another hour and I don't want Ana finding out tomorrow."*

What THING wrote (`step-05.full.json`):

```ts
// Cai wants me to post in #press to let the team know about the situation.
teamPost('press', 'Heads-up from @Ana Duarte — @Cai Zhou is at Lidergraf right now …');
// Wait — I made a mistake in the mention. …
```

Two faults in three lines:

- **Wrong channel.** It posted into `#press` — the channel Cai was already speaking in, where the
  only other participant is the conversation itself. `crossChannelPosts: []` confirms no other
  channel gained anything. The expect is *"THING posts into #studio, a channel it was NOT called
  from"*, and the invariant it serves is the one thing a personal pod structurally cannot do.
- **Wrong attribution.** The message opens *"Heads-up from @Ana Duarte"* when Cai is the source and
  Ana is the person to be told. It noticed and posted a correction immediately after — so the
  channel now holds two near-identical announcements, one of them wrong.

`teamChannels()` was NOT called on this turn, so THING chose a channel without ever listing what
channels exist.

## Attribution

Both are behavioural, in THING's instructions for the team surface, not in the globals
(`libs/core/src/eval/yield-router.ts:371-410`) or the guard (`libs/cli/src/server/team-guard.ts`),
which behaved correctly throughout. Concretely, the instructions appear not to say:

1. that `teamContext().role` decides whether a requested WRITE may be performed, and that a
   `viewer` gets a plain-language refusal naming who can do it instead;
2. that "tell the others" means choosing the channel where the subject is discussed — list them with
   `teamChannels()`, do not default to the current one;
3. that a message THING posts on somebody's behalf is attributed to the person who ASKED.

## Verify a fix

- A `viewer` asking for a write gets a `thing` message that (a) does not perform it, (b) says it is
  because of their role, and (c) names what they can do instead. Assert on the message text, not
  only on the row being unchanged — an unchanged row is also what a fizzled turn produces.
- "Let the others know" from a thread in `#press` about work discussed in `#studio` produces a post
  in `#studio` (`crossChannelPosts` non-empty), attributed to the member who asked.
