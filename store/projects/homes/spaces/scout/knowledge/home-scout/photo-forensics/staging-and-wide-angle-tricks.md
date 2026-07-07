# Staging and wide-angle tricks

## Know the conventions so a caption's silence isn't misread

Listing photography has well-known conventions that make a space look larger or more finished than
it will feel in person: wide-angle lenses that exaggerate room depth, strategically cropped shots
that avoid an awkward layout feature, staged furniture chosen specifically because it's smaller than
what a real tenant would use. None of this is directly detectable from caption text — the point of
knowing these conventions is calibration: don't treat the ABSENCE of a caveat in a caption as
reassurance that a room is really as spacious as it photographs, and don't over-read a polished
listing's silence about square footage as confirmation of generous space (that's exactly what
`sumRoomAreas` cross-checking against `areaSqm` is for — see `floorplan-measurement/`).

## Photo count and coverage as a soft signal

A listing with only 3–4 photos, all of the same one or two rooms, is itself a weak signal worth
noting: it may mean the space has fewer presentable angles than a fuller listing, or simply that the
lister was in a hurry — either way, a low `confidence` on any `photos` finding drawn from a thin photo
set is appropriate, and it's worth naming the thinness itself in `body` as context ("only 3 photos
provided, both of the living area — no photo of the kitchen or bathroom, so condition read is
necessarily partial").

## Never claim to detect staging itself

It's tempting to want to say "these photos look staged" — resist this entirely; that IS a pixel claim
and this engine has no way to make it honestly. What's fair game from text alone: noting when a
caption explicitly says something like "virtually staged" or "photos may not reflect current
furnishings" (portals sometimes disclose this), which is a stated fact, not an inferred one, and
belongs in `body` as a direct citation.
