# Activity-to-gear mapping

## Hiking and outdoor trail days

An `itinerary_items` row whose title or notes mention a hike, trail, or nature reserve justifies
real hiking footwear (boots or trail shoes depending on terrain difficulty found via search),
moisture-wicking socks, and — depending on trail length/elevation found — a small daypack, water
capacity, and sun protection layered on top of whatever the climate section already covers. A short,
paved nature walk doesn't need the same gear as a multi-hour mountain trail; use whatever the
itinerary notes or a quick search on the specific trail says about difficulty/length to calibrate
rather than defaulting to full boots for any outdoor-adjacent item.

## Beach and water activities

A beach day, snorkeling excursion, or any `itinerary_items` row mentioning swimming justifies
swimwear, a quick-dry towel, reef-safe sunscreen (worth calling out specifically for
snorkeling/diving destinations with reef protections), and water shoes when the search turns up a
rocky or coral shoreline rather than sand. Don't add generic "beach gear" without tying it to an
actual beach/water item on the itinerary — a trip that passes near a coast without a scheduled
beach activity doesn't need this.

## City walking days

A day dense with walking-distance activities (a museum crawl, a self-guided walking tour, several
close-together sightseeing stops) is a signal for comfortable, broken-in walking shoes over
fashion footwear, and — if the day's total walking looks long based on the itinerary's number and
spread of stops — blister prevention (moleskin, a spare pair of socks). This is a lower-priority,
lower-specificity item than hiking or beach gear since almost every city trip involves some
walking; only elevate it to an explicit packing item when the itinerary shows an unusually
walking-heavy day (several stops, an unusually long single walking-tour item), not for a normal
mixed day.

## Formal or upscale dinner nights

An `itinerary_items` row noting a formal restaurant, a nice dinner reservation, a show, or similar
dress-code-relevant activity justifies one "smart" outfit item (a collared shirt, a dress, dress
shoes) distinct from the trip's everyday casual wardrobe — easy to overlook when packing mostly for
daytime sightseeing. Only add this when the itinerary genuinely signals a dress-code-relevant
event; don't assume every trip needs formalwear by default.

## Transit-driven gear

A `transit_legs` row with `mode: 'flight'`, or an `itinerary_items` row of `kind: 'transit'`
representing one, justifies travel-specific items distinct from destination-driven ones: a neck
pillow and noise protection for a long-haul or overnight flight, compression socks for a
particularly long leg, and a travel documents pouch to keep boarding passes/passport/copies
together through security. A short regional train or bus leg doesn't need the same kit as a
long-haul flight — scale the item to the leg's actual duration.
