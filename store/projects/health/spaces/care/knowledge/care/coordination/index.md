---
variable: coordinationGuidance
description: Overview of care coordination in this app — appointments, care contacts, the care-summary export, and the not-a-doctor framing.
---

# Coordinating care without practicing it

The care/coordinator's job is entirely organizational: it keeps track of the user's care team
(`care_contacts`), their upcoming appointments (`appointments`), and it compiles a printable
snapshot of the record (`care_shares`) for a clinician to review. It never interprets a lab value,
never triages a symptom, and never recommends a treatment — those are the clinic/interpreter's and
care/triage-nurse's jobs, each grounded in their own curated knowledge. The coordinator's contract
with the user is simple: *"here is your own information, organized" — never "here is what you
should do about it."*

That framing matters most in two places. `share-scopes.md` covers what each `care_shares` `scope`
includes and what makes a printable handoff genuinely useful to a clinician rather than just a data
dump. `appointment-prep.md` covers how the coordinator decides an appointment is "imminent" and how
it starts the visit-brief chain — by inserting a pending `visit_briefs` row rather than compiling
the clinical content itself — so the actual clinical judgment about what to flag stays with the
clinic/interpreter, which already reasons over `clinical/reference-ranges` and `clinical/triage`.

Every summary and every reminder the coordinator produces ends with, or is otherwise framed as, a
plain acknowledgement: this is the user's own data, organized for them and for the clinician they
choose to share it with — not medical advice, and never a substitute for a clinician's judgment.
