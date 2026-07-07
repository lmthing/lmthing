# Transit heuristics

## Ground every estimate in a real search

`haversine` (a scout-space function, used by the locator) gives a straight-line floor, but transit
time is never straight-line — a metro system's actual routing, walking to/from stations, and
transfer waits routinely make a 2 km trip take 25 minutes rather than the 15 a straight line would
suggest. The surveyor's job is to `webSearch` an actual transit-directions query
("transit directions from <address/pin> to <target address>", or a named-route query like
"metro Anjos to Alameda Lisbon minutes") and parse a real minute figure out of the result — never
present a straight-line-derived number as if it were a transit estimate.

## When the search comes back thin

Not every address pair has a clean transit-directions result — a vague claimed pin, an obscure
target address, or a city whose transit isn't well-indexed can all leave the search results without
a clear number. When that happens, it's better to leave `minutes` at a clearly-flagged low-confidence
value and say so in `basis` ("no clear transit route found from the claimed pin — treat as
unverified") than to average together unrelated search results into a number that LOOKS precise but
isn't grounded in anything real.

## Starting point matters more than people expect

Two listings on the same street can have meaningfully different commute times if one's claimed pin
is fuzzed toward the wrong end of the block relative to the actual nearest station entrance. This is
exactly why `basis` names the starting point explicitly: a listing whose commute was computed from a
tight `location_guesses` circle (post-locator) is more trustworthy than one still using a raw,
possibly-fuzzed claimed pin — a user comparing two "18 minute" commutes should be able to tell, from
`basis` alone, that one of them is on firmer ground than the other.
