# PROGRESS — scenario-campaign · task `06-tanzania` · round 6

_Started 2026-07-15T19:30:34.873Z. The agent MUST update this file at every step._

## Steps

- Read the invocation instructions and initialized the round; started a clean local replay from step 1.
- Judged step 01 as FAIL: the trace has a vision delegate for the photo and file delegates/readDocument yields for markdown/XLSX/PDF, but no audio delegate or transcription yield for `voice-memo.mp3`; stopped the runner at the first failure.
- Reproduced step 01 cleanly in `attempt-2`: upload metadata proves Whisper transcription succeeded and the audio transcript was injected into THING's message; failure is instead THING treating the plain-text `system-files/dispatch` return as an object, then displaying `filesAnswer is a string` before offering.
- Applied an L1 general prompt fix: attachment delegate results are plain-text summaries and must be composed into a user reply in the same statement, never inspected as object-shaped data; added a prompt-contract regression assertion and updated the system-spaces documentation. Prompt-literal grep found no new Tanzania-specific scenario tokens in the change.
- Fresh verification replay (`attempt-3`, steps 1..1) PASS: photo vision delegation, files dispatcher → reader/sheet → `readDocument` parsing, and persisted Whisper transcript for `voice-memo.mp3`; THING offered an openable organizer grounded in Emmanuel, TZS 35,000 / TZS 5,000, Stone Town, and the spreadsheet/PDF. It authored no spaces, tables, pages, or app. Prompt-contract test (12/12) and `pnpm docs:check` (4554 citations) pass.

<!-- append one bullet per step: what you did -->

## Files added to context

<!-- append every file you had to read / add to your context, with why -->
