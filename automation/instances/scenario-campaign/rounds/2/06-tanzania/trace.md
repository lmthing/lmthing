
## Step 1 — attach, say

**sent:** Ok this is getting out of hand. I've got the whole Tanzania trip spread across about six different places — a notes file, a spreadsheet with the costs, the crater park-fee PDF, a photo I liked from St
- delegates: system-vision/vision, system-files/dispatch, system-files/reader, system-files/sheet
- yields: delegate, loadKnowledge, readDocument, inspect
- reply: {"type":"Stack","props":{"gap":2},"children":[{"type":"Paragraph","props":{},"children":["OK Vasilis, I've read through everything — and you're right, it's a lot to keep straight. Here's what I found across your five pieces:"]},{"type":"Par
- spaces: (none)

**expect (judge verifies):**
  - [ ] all five files are actually read — the photo LOOKED AT (vision), the voice memo TRANSCRIBED, the PDF and the spreadsheet PARSED
  - [ ] it OFFERS to organize this without being asked, naming at least two real specifics of mine (a place, a date, a booking)
  - [ ] it builds NOTHING yet — no spaces, no tables, no pages, no app (the offer precedes any authoring yield)

## Step 2 — say

**sent:** Yes please.
- delegates: system-architect/architect/synthesize_and_run, system-architect/architect/synthesize_and_run, system-architect/architect/synthesize_and_run, system-architect/architect/synthesize_and_run, system-architect/architect/synthesize_and_run, system-appbuilder/automator/build_live_project
- yields: tasklist, readDocument, loadKnowledge, delegate, sleep, registerSpace, inspect
- errors: typecheck_error@1, typecheck_error@1, typecheck_error@1, eval_error@undefined, eval_error@undefined
- reply: {"type":"Stack","props":{"gap":2},"children":[{"type":"Callout","props":{"variant":"success","title":"All organized"},"children":["Everything from your notes, spreadsheet, park-fee PDF, voice memo, and Stone Town photo is now in one place."
- spaces: Ngorongoro Advisor, Stone Town Advisor, Tanzania Safari Advisor, Tanzania Trip Advisor, Tanzania Trip Planner
- app tables: accommodation(8), contacts(2), cost_items(21), flights(3), itinerary_days(18), notes(3), packing_list(24), park_fees(8)

**expect (judge verifies):**
  - [ ] SPACES GET CREATED — the supplied material is split across MULTIPLE specialist agents for distinct parts of the trip (the real places/legs it covers), grounded in the supplied content — NOT dumped into a single generic catch-all space. The exact partition is the model's call; what fails is one catch-all, or no specialists at all.
  - [ ] MY TRIP LANDS IN THE DB — legs, dates, lodging, costs, the park fees, what I've already paid
  - [ ] flight reference ZZJQUU (from the notes) is a real DB row — proof the notes were parsed, not guessed
  - [ ] the spreadsheet's cost lines land as DB rows (the run toward the 3344.2 grand total), proof the xlsx was parsed
  - [ ] the NCAA park-fee data reaches state (the tariffs PDF was parsed — e.g. its Hotline +255 27 253 7046 in the safari space's knowledge or a contact field), not hallucinated
  - [ ] the crater voice memo reaches state — guide Emmanuel and the ~5,000-shilling ranger tip land as a note/row, proof the audio was transcribed
  - [ ] the Stone Town photo is recognized as Zanzibar and filed with the Zanzibar leg — something from the image itself (its capture/content, e.g. Canon PowerShot SX30 IS), not the filename, reaches state
  - [ ] AN APP'S REAL PAGES ARE AUTHORED on those tables — pages wired to show my real rows; the next step opens and serves them
  - [ ] NO RESEARCH HAPPENS in this whole build (no webSearch/webFetch yields): everything it needed, I handed it