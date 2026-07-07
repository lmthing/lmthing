# Text vs. evidence contradictions

## The recurring shapes

A handful of contradiction patterns show up again and again in real listings: a "bright, south-facing"
or "quiet street" claim contradicted by a caption mentioning a courtyard/interior view or a
busy-road-adjacent detail; a "recently renovated" or "modern" claim next to a caption that names a
datable fixture (avocado-era tile, a visibly older appliance model); a claimed amenity (elevator,
parking, pets allowed) that a floor/building description elsewhere in the same text seems to
contradict (e.g. "3º andar, sem elevador" naming NO elevator right next to marketing copy that
implies easy access); a stated room count that the floor-plan cross-check (see
`floorplan-measurement/`) can't support with anywhere near that many distinguishable spaces.

## Grade the contradiction by how directly it conflicts

Not every tension is equally strong: a description saying "bright" with no orientation claim at all,
next to a neutral caption, is NOT a contradiction — it's just an unverified claim (see
`photo-forensics/light-and-orientation.md`). A genuine mismatch requires the SECOND piece of evidence
to actively conflict with the first, not merely fail to confirm it. Reserve the `mismatch` kind and a
`photo_text_mismatch` flag for the former case; an unverified-but-uncontradicted claim doesn't earn a
flag at all, just, at most, a low-confidence note.

## Always cite both sides

A mismatch finding is only as convincing as its citation of BOTH the claim and the conflicting detail
— "the description states X [description, para 2], but photo 5's caption says Y" is the standard to
hit. A mismatch claim that only cites one side (just asserting "this seems inconsistent" without
naming the second piece of text) is not a defensible finding and shouldn't be written.
