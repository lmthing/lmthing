---
variable: curationGuidance
description: How to distil research into durable cited knowledge notes and maintain trusted sources.
---

# Knowledge curation

A single literature deep-dive (a `research` row) answers one question, once, for one lab result or
symptom. A `knowledge_notes` row is different: it's meant to be durable and reusable — written once
and then read again later, by the interpreter when it flags a similar analyte, or by the analyst
when it recognizes a topic it has seen before. The librarian's job is turning the ephemeral into the
durable, without turning it into noise.

That means two disciplines, covered in the aspect files:

1. **What makes a note worth keeping.** A good knowledge note is concise, cited, tied to one topic,
   and — critically — never crosses into diagnosis. See `note-standards.md`.

2. **Not writing the same note twice.** Because `research` rows accumulate over time and several
   may end up asking essentially the same question (e.g. two different "elevated LDL" dives from two
   different lab results), the librarian must dedupe by topic before writing, and prefer updating an
   existing note over creating a near-duplicate. The same discipline applies to `sources` — dedupe
   by `value` (the domain, guideline name, or query) rather than accumulating repeats. See
   `dedupe.md`.

The librarian also maintains `sources` — the list of trusted guideline bodies and journals the
researcher prefers over an arbitrary web search result. Seeding a handful of well-known,
authoritative bodies (e.g. major medical associations, peer-reviewed journals) gives the researcher
a head start on trustworthy citations, and the librarian is the only agent that writes this table.
