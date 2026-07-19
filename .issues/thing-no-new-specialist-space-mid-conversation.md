# THING: a NEW topic mid-conversation gets rows/pages but no specialist space

**Symptom** (07-life-admin run 19 step 11, reconfirmed run 22): user introduces a brand-new life
topic mid-conversation. THING lands the DB rows and the app page (14 pages, built:true) but never
creates a specialist SPACE for the topic — `spaceCount` stayed 8. Later topic questions have no
owning space to route to (no knowledge home, no answer action).

**Expected:** the same organize principle that split the initial bulk dump applies incrementally: a
distinct new topic with facts ⇒ its own specialist space (knowledge + answer action), not just rows.

**Attribution sketch:** THING's mid-conversation path routes new facts through write_fact →
db/automator, but nothing evaluates "does this topic deserve a NEW specialist?" — that judgment only
exists inside organize_material's initial split. Candidate fix (L2): a lightweight check in the
write path (or a dedicated tasklist node) that, when a fact's topic matches NO registered space,
proposes/creates the specialist via the architect — with dedup against existing same-topic spaces
(see the earlier duplicate-specialist finding).

**Where:** `sdk/org/libs/core/system-spaces/user-thing/**` (instruct routing + possibly a new
tasklist node); architect delegation for the space creation.
