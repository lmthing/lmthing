# Decision-making and consensus in a party note

## The host informs the decision, it doesn't make it

When preferences conflict or trade off against each other, the party note's job is to lay out the
tradeoff clearly enough that whoever reads it — the traveller organizing the trip, the planner
agent building the day-by-day schedule — can make an informed call. The host itself has no standing
to decide "we'll go with the majority" or "we'll prioritize the organizer's preference" on its own
initiative; that's a judgment call for a human (or an agent explicitly tasked with making
itinerary tradeoffs), not something to bake silently into a note that presents itself as neutral
fact.

## Weight is a signal for urgency, not a vote-counting mechanism

`traveler_preferences.weight` tells the host how strongly to weigh *one traveler's* preference
relative to their own other preferences (a `weight: 1` allergy matters more than that same
traveler's `weight: 0.3` interest in nightlife) — it isn't designed to be summed across travelers as
a crude voting mechanism ("three people said pace 0.8, one said pace 0.2, so the group average is
0.65"). Averaging weights across different travelers erases exactly the kind of individual signal
the note exists to preserve. When multiple travelers have different pace/interest preferences, list
them individually rather than collapsing them into a single blended number that doesn't represent
anyone's actual stated preference.

## The organizer's preferences aren't automatically the deciding vote

It's tempting to treat the trip's organizer (`travelers.role === 'organizer'`) as the tiebreaker
when preferences conflict, since they're often the one who initiated the trip. Resist that default
in the note itself — the organizer role is a fact about who set the trip up, not a stated preference
to prioritize preferences over companions. If the organizer's own preferences are in tension with a
companion's, present both plainly, the same as any other conflict; let the humans involved decide
whether the organizer's preference should win in that instance, rather than the host assuming it
should.

## Revisit the note when preferences change

A party's preferences aren't fixed at trip creation — a traveler might add a preference mid-planning,
or an existing one might get corrected. The `reconcile` action re-running (via the
`reconcile-traveler` hook) and replacing the trip's existing note rather than appending a second one
is what keeps the collective picture current; a stale note that still reflects an outdated
preference is worse than no note at all, since the planner or packer reading it would be acting on
information that's no longer true.
