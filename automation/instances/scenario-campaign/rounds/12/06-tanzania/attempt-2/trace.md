
## Step 1 — attach, say

**sent:** Ok this is getting out of hand. I've got the whole Tanzania trip spread across about six different places — a notes file, a spreadsheet with the costs, the crater park-fee PDF, a photo I liked from St
- delegates: system-vision/vision, system-files/dispatch, system-files/reader, system-files/sheet
- yields: delegate, loadKnowledge, readDocument, inspect
- errors: typecheck_error@1, typecheck_error@1, typecheck_error@2
- reply: {"type":"Stack","props":{"gap":2},"children":[{"type":"Heading","props":{"level":2},"children":["Here's what you've got — it's actually a great set"]},{"type":"Paragraph","props":{},"children":["Between your notes, spreadsheet, the park-fee
- spaces: (none)

**expect (judge verifies):**
  - [ ] all five files are actually read — the photo LOOKED AT (vision), the voice memo TRANSCRIBED, the PDF and the spreadsheet PARSED
  - [ ] it OFFERS to organize this without being asked, naming at least two real specifics of mine (a place, a date, a booking)
  - [ ] it builds NOTHING yet — no spaces, no tables, no pages, no app (the offer precedes any authoring yield)

## Step 2 — say

**sent:** Yes please.
- delegates: system-appbuilder/automator
- yields: setSessionMeta, delegate, readDocument, inspect
- errors: typecheck_error@1
- reply: {"type":"Stack","props":{"gap":2},"children":[{"type":"Heading","props":{"level":2},"children":["It's done — your Tanzania trip has a home now 🎉"]},{"type":"Callout","props":{"variant":"success","title":"Live app ready"},"children":["Open 
- spaces: (none)
- app tables: cost_items(18), itinerary_legs(8), loose_ends(8), park_fees(50), trip_notes(32)

**expect (judge verifies):**
  - [ ] SPACES GET CREATED — one per leg (Cairo, the safari/Ngorongoro leg, Zanzibar, Dar es Salaam), each with its own agent, not one generic space
  - [ ] MY TRIP LANDS IN THE DB — legs, dates, lodging, costs, the park fees, what I've already paid
  - [ ] flight reference ZZJQUU (from the notes) is a real DB row — proof the notes were parsed, not guessed
  - [ ] the spreadsheet's cost lines land as DB rows (the run toward the 3344.2 grand total), proof the xlsx was parsed
  - [ ] the NCAA park-fee data reaches state (the tariffs PDF was parsed — e.g. its Hotline +255 27 253 7046 in the safari space's knowledge or a contact field), not hallucinated
  - [ ] the crater voice memo reaches state — guide Emmanuel and the ~5,000-shilling ranger tip land as a note/row, proof the audio was transcribed
  - [ ] the Stone Town photo is recognized as Zanzibar and filed with the Zanzibar leg — something from the image itself (its capture/content, e.g. Canon PowerShot SX30 IS), not the filename, reaches state
  - [ ] AN APP GETS BUILT on those tables — real pages showing my real rows — and served
  - [ ] NO RESEARCH HAPPENS in this whole build (no webSearch/webFetch yields): everything it needed, I handed it