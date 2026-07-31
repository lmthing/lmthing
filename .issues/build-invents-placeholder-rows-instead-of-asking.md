# The build seeded the app with invented rows ("Boat 1"…"Boat 4") instead of asking what the boats are called

**Symptom** (scenarios/22-crossfire run 2 step 2, 2026-07-31): Sam asked for a way to see what is in
the yard. He said *"Four boats in at the moment"* — a count, never the names. THING built the app
and populated it with four rows it made up:

`runs/2/step-03.full.json`, `state.appTables.boats`:

```json
{"id":"da644faf…","name":"Boat 1","owner":null,"status":"in yard"}
{"id":"020b0851…","name":"Boat 2","owner":null,"status":"launched"}
{"id":"14a90293…","name":"Boat 3","owner":null,"status":"awaiting parts"}
{"id":"66e7d69b…","name":"Boat 4","owner":null,"status":"complete"}
```

Both the names and the statuses are fabrications. The real ones were one question away, and the
scenario was holding the answers:

```yaml
- as: sam
  in: yard
  reply_to: 1
  say: "go on then"
  if_asked:
    "which boats": "Kittiwake, Marisol, Bright Penny, and a folkboat that hasn't got a name yet."
    "what states": "Quoted, approved, in progress, or waiting on parts."
```

THING never asked, so the harness never got to answer. The statuses it invented
(`in yard / launched / awaiting parts / complete`) are not the yard's vocabulary
(`quoted / approved / in progress / waiting on parts`), so the app cannot express the states the
business actually uses.

## Why this is the worst kind of failure for this scenario

22-crossfire exists to test concurrent change to shared data. Step 3 sent two real updates at once,
and neither could land against invented rows:

- Ivo (`#yard`): *"marisol is waiting on parts now the shaft is a special order 3 weeks"* → THING
  answered *"I see the yard tracker has four boats but they're all placeholder names — Boat 1 through
  Boat 4. No 'Marisol' in the system"* (`runs/2/step-03.json`).
- Rae (`#office`): the lift-out fee change produced a raw project-state dump and no field.

So steps 3–6 cannot score the property they exist for. The same is true of step 4's contradiction
(two people asserting different states for **Bright Penny**, a boat that does not exist in the data)
and step 7's `open_app`.

## The rule this breaks

The scenarios state it directly, and it is the invariant the whole suite is built on:

> **IF THE APP SHOWS IT, IT'S A DB ROW** — never chat prose, never a knowledge file.
> **A GOOD QUESTION IS ANSWERABLE BY THE PERSONA in their own words.**

"What are the four boats called?" is exactly such a question — a boatyard owner answers it in four
words. The competing rule, *DON'T INTERROGATE INSTEAD OF ACTING*, is about not demanding a form's
worth of fields before doing anything; it is not a licence to invent the user's data. Placeholder
rows are worse than an empty table: an empty table is obviously unfinished, whereas "Boat 1" looks
like a record and will be read as one.

Note this is NOT the same as 20-studio, where Ana named her three jobs in the opening message and
they were seeded correctly. The difference is precisely that here the names were not in the
transcript — which is the case where asking is required.

## Evidence

- `sdk/org/scenarios/22-crossfire/runs/2/step-02.json` — the build (`delegates: ["system-appbuilder"]`, 918s)
- `sdk/org/scenarios/22-crossfire/runs/2/step-03.{json,full.json}` — the four invented rows, and
  Ivo being told his boat is not in the system
- `sdk/org/scenarios/22-crossfire/scenario.yaml` — the `if_asked` answers that were never requested

## Verify a fix

Play 22-crossfire steps 1–3. After step 2 the `boats` table must contain Kittiwake, Marisol, Bright
Penny and the unnamed folkboat — with the folkboat present rather than dropped for being awkward —
and no row whose name matches `/^Boat \d+$/`. Whether that is achieved by asking or by some other
means is the builder's business; inventing four is not one of them.
