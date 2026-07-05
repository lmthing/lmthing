# Even vs. weighted splits

## Even is the default because it requires no assumption

Splitting an expense evenly across every traveler on the trip needs no information beyond "how many
people are on this trip" — it's the one split the treasurer can make with total confidence it isn't
inventing a fact about who consumed what. Any weighted alternative (a child's half-portion, someone
who skipped a paid activity, an explicit cost-sharing agreement the travelers set up themselves)
requires a real signal the treasurer can point to. Absent that signal, defaulting to even and
letting a human correct an individual `expense_shares.shareAmount` afterward is far safer than
guessing a weighting and getting it wrong in a way nobody asked for.

## When a real signal justifies deviating from even

A few patterns come up often enough to be worth naming explicitly:

- **A traveler didn't participate.** If an `itinerary_items` row or an explicit note says a
  particular activity's cost was only for the travelers who actually went (not the whole party —
  someone stayed back at the hotel), the expense should only be split across the participants, not
  the full roster. This needs an actual signal that participation was partial — don't infer it from
  a `role: 'child'` traveler alone, since plenty of trips split child costs evenly too.
- **A `role: 'child'` traveler with a known reduced cost.** Some categories (a kids' menu, a
  reduced museum admission) genuinely cost less per child. If the expense's `description` or
  `amount` already reflects that reduced cost bundled into a single line item, split evenly across
  however many people that line item actually covers — don't apply an additional discount on top
  of an amount that already accounts for it.
- **An explicit request.** A traveller or chat user asking for a specific split ("just put the hotel
  on me and my partner, not the group") is the clearest possible signal — honor it exactly, with
  the named subset of travelers only.

## How to weight when a real signal exists

When a deviation is justified, keep the math simple and auditable: assign each included traveler a
weight (equal weights for a straightforward subset-of-the-party split; unequal only when the
signal itself is unequal, e.g. "twice as much for the double room"), then distribute the amount
proportionally to weight using the same cent-exact rounding discipline as `splitEvenly` — no
traveler's `shareAmount` should be a number that doesn't trace back cleanly to (amount × weight ÷
total weight). Never invent a weight from a vague impression ("they probably ate less") — if the
signal isn't concrete enough to state as a reason in the expense's context, it isn't concrete
enough to act on.
