---
variable: dealHunting
description: How the deal-hunter finds real, citable savings on a trip's fares, stays, and activities, and how to tell a genuine value opportunity from a headline price that isn't actually one.
---

# Hunting real deals

A `deals` row is a claim that there's a real way to save money on some part of the trip — a
cheaper flight window, a better-value hotel, a discounted activity, a transit pass — and, like every
other advisory claim in the trips concierge, it has to be grounded in something actually searched,
never a plausible-sounding guess. The deal-hunter's job is narrower than it sounds: it doesn't book
anything, doesn't lock in a price, and doesn't guarantee a saving will still be there when the
traveller acts on it. It surfaces an opportunity, cites where it found it, and lets the traveller
(or a future booking flow elsewhere in the app) decide whether to act.

`fare-windows.md` covers when flights, hotels, and activities are actually cheapest — the booking-
window and day-of-week patterns worth searching for and citing, distinct from `transit_legs`'
own booking-window guidance (the navigator's concern is *when to book what's already planned*; the
deal-hunter's is *whether there's a cheaper way to get the same outcome*). `value-vs-price.md`
covers the harder judgment call: distinguishing a genuine value opportunity (a city pass that
actually pays for itself given the traveller's planned activities, a transit pass cheaper than
individual tickets) from a headline discount that doesn't hold up once the fine print or the
traveller's actual plans are considered.

Every `deals` row should read like a researched recommendation, not a bare number: what the saving
is, roughly how much it's worth, where it came from, and — critically — whether it's actually
relevant to *this* trip's plans rather than a generic "deals near you" result. A deal with no clear
tie to the trip's actual destinations, dates, or planned activities isn't worth writing.
