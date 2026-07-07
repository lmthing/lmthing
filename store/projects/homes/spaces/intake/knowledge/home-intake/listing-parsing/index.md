---
variable: listingParsing
description: How the clipper turns pasted alert-email text, saved-search pages, and links into clean, deduped listings rows — for the parse-captures tasklist's segment/extract/dedupe/merge steps.
---

# Parsing pasted listings

Every `raw_captures` row is untrusted, messy, portal-specific text: a digest email with several
listings jammed together, a single pasted link, or a chunk of a saved-search results page. The
clipper's job is to turn whatever shape that took into the SAME canonical `listings` columns
regardless of source — a user comparing two homes should never notice one came from an email and
the other from a link.

`portals-and-alert-emails.md` covers how to segment and extract fields from each capture shape;
`dedupe-and-canonicalization.md` covers how newly extracted candidates get matched against (and
merged into, or kept apart from) listings already tracked for the search; `polling-and-politeness.md`
covers the opt-in, robots-aware polling path that feeds the same pipeline with fresh captures
without the user having to paste anything.

The one invariant that spans all three: never invent a field. `extractListingFields` and
`parsePortalHtml` are deterministic extractors that leave a field at its zero/empty default when the
source text doesn't state it — resist the temptation to fill an empty `yearBuilt` or `floor` with a
plausible-sounding guess "since most units on this street are like that." A blank field the user can
see is missing is far more useful than a wrong number that looks confident.
