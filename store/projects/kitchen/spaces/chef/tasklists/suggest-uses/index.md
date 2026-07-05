---
input: {}
---

Find pantry ingredients about to expire and surface a `suggestions` card pointing at a recipe that
uses each one up — the household's waste-reduction nudge. Triggered by a nightly cron hook that
carries no structured input, so this whole tasklist self-queries the database for the work. See
`pantry/pantry-management`'s `expiry-and-waste.md` for how "expiring soon" and duplicate-nagging
avoidance are meant to work.
