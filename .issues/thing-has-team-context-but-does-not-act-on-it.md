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


---

## 3. It invented a colleague who is not in the directory (20-studio run 4 step 9)

Rita, a viewer, was refused correctly — the refusal itself is a clear improvement and is recorded in
the run-4 report. But the alternative it offered names somebody who does not exist:

> *"Only an admin or editor can do writes — you'd need **@Rui** or whoever set this up to promote
> your role, or to make the change themselves."*

The cast is ana, bo, cai and rita (`20-studio/scenario.yaml`), and the directory THING can read
returns exactly those four. `teamMembers()` was NOT called on this turn — only `teamContext()` —
so the one name in the sentence is the one thing in it that was guessed.

This is the same fault as §1 and §2 in a third form: the team facts are one call away and the turn
answers from invention instead. "Ask an editor" is the right shape of answer; naming a person
requires reading the directory, and if it is not read, no name should appear.

Evidence: `sdk/org/scenarios/20-studio/runs/4/step-09.json` — `wrote.globals` is
`["display","teamContext"]`; the reply text is in
`runs/4/data/.lmthing/.team/channels/studio.jsonl`.

**Verify:** a refusal that names anybody must have called `teamMembers()` in the same turn, and every
`@name` in a channel message must resolve to a directory entry.

---

## 4. Two people contradict each other about the same boat and neither is told (22-crossfire run 4 step 4)

This is the beat 22-crossfire exists for. In the same instant, in two channels:

- Sam, `#yard`: *"bright penny is approved, I spoke to the owner this morning"*
- Rae, `#office`: *"bright penny is still only quoted — they have not paid the deposit and I am not
  starting anything until they do"*

Both turns answered well **in isolation** — readable, no jargon, and each asked rather than guessing
(`step-04.full.json`). Three of the step's four expectations pass: nothing was silently decided,
no row was left misrepresenting either of them, no compromise state was invented.

The load-bearing one fails:

> *"The contradiction is surfaced to the people in it, in the channels they spoke in, naming what the
> other person said."*

Neither reply mentions the other person at all. Sam is invited to pick which boat is Bright Penny so
the approval can be recorded; Rae is offered deposit tracking. Each turn behaves as though it is the
only conversation happening. `crossChannelPosts: []`.

**This was discoverable and was not looked for.** The two messages are both posted before either turn
is dispatched, so each was in the record the whole time — and Rae's turn ran 132 seconds with three
`user-memory/memory` delegate round-trips, so it was not short of opportunity. Globals used:
`["display","teamContext"]` (Sam) and `["tasklist","display","teamContext"]` (Rae). **`teamHistory`
was not called by either**, which is the call that would have shown the other channel.

So this is §1–§3's fault in a fourth form: `teamContext()` is fetched reflexively, and then the turn
reasons as if it were a single-user pod. A personal pod cannot have this bug; it is the whole
difference the team surface is supposed to make.

**Caveat on scoring, not on the finding:** step 4 is weakened by
[build-invents-placeholder-rows-instead-of-asking](./build-invents-placeholder-rows-instead-of-asking.md)
— "Bright Penny" is not a row, so both turns spent themselves on *which boat is she?* rather than on
the collision. The contradiction is still fully present in the two messages, and noticing it needs no
row. But a clean re-score of this beat needs the placeholder-rows defect fixed first.

**Verify:** with real rows seeded, deliver the two step-4 messages concurrently and assert each
channel receives a reply that names the other member's claim. `teamHistory` (or an equivalent
cross-channel read) must appear in at least one turn's globals.
