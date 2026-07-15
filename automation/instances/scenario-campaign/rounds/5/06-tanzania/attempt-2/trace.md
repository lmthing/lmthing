
## Step 1 — attach, say

**sent:** Ok this is getting out of hand. I've got the whole Tanzania trip spread across about six different places — a notes file, a spreadsheet with the costs, the crater park-fee PDF, a photo I liked from St
- delegates: system-vision/vision, system-files/dispatch, system-files/sheet, system-files/reader
- yields: loadKnowledge, setSessionMeta, delegate, readDocument, inspect
- reply: {"type":"Stack","props":{"gap":2},"children":[{"type":"Heading","props":{"level":2},"children":["Ok, I've read everything you sent — here's what I see"]},{"type":"Callout","props":{"variant":"info","title":"You've actually got a solid trip 
- spaces: (none)

**expect (judge verifies):**
  - [ ] all five files are actually read — the photo LOOKED AT (vision), the voice memo TRANSCRIBED, the PDF and the spreadsheet PARSED
  - [ ] it OFFERS to organize this without being asked, naming at least two real specifics of mine (a place, a date, a booking)
  - [ ] it builds NOTHING yet — no spaces, no tables, no pages, no app (the offer precedes any authoring yield)