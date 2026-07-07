# Portals and alert emails

## Two very different source shapes

A pasted alert-email digest ("14 new listings match your search") packs several listings into one
blob of text, usually separated by blank lines or a rule (`---`, `===`) — `parseAlertEmail` segments
on those boundaries first, falling back to splitting on price anchors only when the whole body has
no blank-line structure (a single unformatted paste). Each resulting block still needs
`extractListingFields` to actually pull out price, size, rooms, floor, and year — segmentation and
extraction are deliberately separate steps because the same extractor is reused whether a block came
from an email, a pasted paragraph, or (indirectly) a saved-search card during polling.

A pasted LINK is different: it's one listing, and it's worth actually fetching, because the full
portal page carries far more signal than an email digest's terse summary line — a real description,
a photo gallery with captions, sometimes a full JSON-LD structured-data block. `parsePortalHtml`
always prefers a `schema.org/RealEstateListing`/`Residence`/`Product` JSON-LD block wholesale over
scraped heuristics when the page has one, because portals that bother to publish structured data
tend to keep it accurate and complete — falling back to scraping `<meta property="og:*">` tags,
`<title>`/`<h1>`, and `<img>` tags only when no such block exists.

## Regional idioms worth knowing

European listings encode fields in ways a naive English-only parser would miss: `T2`/`T3` (Portugal)
means 2/3 bedrooms; `85 m²`/`85m2` is size, not a typo of `85 m`; `3º andar` or `piso 3` is a floor;
a `de 1998` or bare `1998` near "built"/"construído" is the construction year. `extractListingFields`
and `parsePortalHtml` both recognize these idioms, but when hand-inspecting a capture that failed to
extract cleanly, check whether the source uses a locale idiom neither function's regexes cover yet
before assuming the extraction is simply wrong.

## Price extraction is anchored, not blind

A block's first number isn't necessarily its price — a `T2` or a `3º andar` digit can sit upstream of
the actual price in the raw text. `extractListingFields` anchors on a currency-symbol- or
currency-code-bearing run first (`€1.600`, `1 600 €`, `EUR 1600`), falling back to a `/month`-suffixed
run only when no symbol/code is present. When manually reviewing a bad extraction, check whether the
capture's price token genuinely lacked a currency marker — that's the one case where the anchor can
legitimately grab the wrong number.
