# Appointment prep: deciding "imminent" and starting the visit-brief chain

The coordinator's `reminders` action runs each morning and does two distinct things: it surfaces
every upcoming appointment (informational, no side effects), and — only for one that's imminent —
it kicks off the visit-brief chain. These are separate concerns; only the second one writes
anything.

## What counts as "imminent"

An appointment is imminent when its `scheduledAt` falls within the next **48 hours** of the current
reconcile pass. That's a narrow enough window that a brief compiled from it reflects genuinely
current data (recent flagged labs, ongoing symptoms, recent trends) without being prepared so early
that it goes stale before the visit. Anything further out is simply listed in the reminder; nothing
is prepared for it yet — the next morning's pass will catch it once it crosses into the window.

## Never do the clinical compilation yourself

The coordinator does **not** know how to write a clinical prep brief — that's a distinct
competency that belongs to the clinic/interpreter, which reasons over `clinical/reference-ranges`
and `clinical/triage` to decide what's worth surfacing and how to phrase it. Instead of writing
that content, the coordinator starts the existing chain the interpreter already owns:

1. Insert a pending `visit_briefs` row (`status: 'pending'`, a title like
   `Visit prep — <appointment title>`).
2. That insert fires `hooks/prepare-visit-brief.ts`, which triggers `clinic/interpreter#prep` — the
   interpreter finds this new pending row on its own reconcile pass and compiles the actual brief
   (flagged labs, active symptoms, trends, research on file, ending in questions to ask).
3. Once the row exists, link it back onto the appointment via `appointments.prepBriefId`, so the
   appointment and its brief are associated from the coordinator's own read of `appointments` going
   forward.

This is the same "hooks over a shared db" pattern used elsewhere in this app (e.g. the interpreter
queuing a `research` row for the researcher rather than delegating to it directly): each agent only
ever inserts the row that starts the *next* agent's own trigger, and never calls into another
agent's action.

## Keeping it bounded

Only ever start this chain **once** per appointment: skip an appointment whose `prepBriefId` is
already set, whether the brief behind it is still `pending` or already `ready`. That check is what
keeps a re-run of the morning pass from queuing a second, duplicate brief for the same visit — the
`appointments` update the coordinator makes here isn't watched by any insert hook, and the
`visit_briefs` insert is the interpreter's trigger, not the coordinator's own, so nothing loops.
