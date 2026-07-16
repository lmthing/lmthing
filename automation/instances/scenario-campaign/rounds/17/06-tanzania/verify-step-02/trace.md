
## Step 1 — attach, say

**sent:** Ok this is getting out of hand. I've got the whole Tanzania trip spread across about six different places — a notes file, a spreadsheet with the costs, the crater park-fee PDF, a photo I liked from St
- delegates: system-files/dispatch, system-vision/vision, system-files/reader, system-files/sheet
- yields: loadKnowledge, delegate, readDocument, inspect, setSessionMeta
- errors: typecheck_error@1, eval_error@undefined, eval_error@undefined
- reply: {"type":"Stack","props":{"gap":2},"children":[{"type":"Paragraph","props":{},"children":["OK, I went through everything you sent — there's actually a lot of good stuff here, just spread thin. Here's what I can see:"]},{"type":"List","props"
- spaces: (none)

**expect (judge verifies):**
  - [ ] all five files are actually read — the photo LOOKED AT (vision), the voice memo TRANSCRIBED, the PDF and the spreadsheet PARSED
  - [ ] it OFFERS to organize this without being asked, naming at least two real specifics of mine (a place, a date, a booking)
  - [ ] it builds NOTHING yet — no spaces, no tables, no pages, no app (the offer precedes any authoring yield)

## Step 2 — say

**sent:** Yes please.
- delegates: system-architect/architect/synthesize_and_run, system-architect/architect/synthesize_and_run, system-architect/architect/synthesize_and_run, system-appbuilder/automator/build_live_project
- yields: tasklist, readDocument, delegate, registerSpace, inspect
- errors: typecheck_error@1, typecheck_error@1
- reply: {"type":"Stack","props":{"gap":2},"children":[{"type":"Paragraph","props":{},"children":["All done — your Tanzania trip is now organized in one place. Here is what you have got:"]},{"type":"List","props":{"items":["An itinerary app page at 
- spaces: Cairo Stopover Advisor, Stone Town Advisor, Tanzania Safari Camping Advisor
- app tables: itinerary_stops(9)

**expect (judge verifies):**
  - [ ] SPACES GET CREATED — the supplied material is split across MULTIPLE specialist agents for distinct parts of the trip (the real places/legs it covers), grounded in the supplied content — NOT dumped into a single generic catch-all space. The exact partition is the model's call; what fails is one catch-all, or no specialists at all.
  - [ ] MY TRIP LANDS IN THE DB — legs, dates, lodging, costs, the park fees, what I've already paid
  - [ ] flight reference ZZJQUU (from the notes) is a real DB row — proof the notes were parsed, not guessed
  - [ ] the spreadsheet's cost lines land as DB rows (the run toward the 3344.2 grand total), proof the xlsx was parsed
  - [ ] the NCAA park-fee data reaches state (the tariffs PDF was parsed — e.g. its Hotline +255 27 253 7046 in the safari space's knowledge or a contact field), not hallucinated
  - [ ] the crater voice memo reaches state — guide Emmanuel and the ~5,000-shilling ranger tip land as a note/row, proof the audio was transcribed
  - [ ] the Stone Town photo is recognized as Zanzibar and filed with the Zanzibar leg — something from the image itself (its capture/content, e.g. Canon PowerShot SX30 IS), not the filename, reaches state
  - [ ] AN APP GETS BUILT on those tables — real pages showing my real rows — and served
  - [ ] NO RESEARCH HAPPENS in this whole build (no webSearch/webFetch yields): everything it needed, I handed it