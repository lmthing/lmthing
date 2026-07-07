---
variable: locationTriangulation
description: How the locator turns a fuzzed claimed pin plus textual clues into a confidence-scored guess circle, via intersectClues/haversine — always advisory, never presented as the true address.
---

# Triangulating a real location

Portals fuzz map pins for listing privacy — typically by a few hundred meters, sometimes more in
lower-density areas. The claimed pin is a useful starting clue, not ground truth, and the locator's
whole job is combining it with whatever textual hints a listing's description and captions happen to
contain into a single, honestly-uncertain guess.

`fuzzed-pin-strategies.md` covers how to treat the claimed pin itself as one input among several
rather than an anchor to be corrected FROM; `clue-extraction-and-intersection.md` covers finding and
weighting the textual clues that `intersectClues` combines, and reading its confidence output
honestly.
