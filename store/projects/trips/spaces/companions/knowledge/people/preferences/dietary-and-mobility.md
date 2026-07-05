# Diet and mobility: the high-stakes categories

## Diet: hard allergies vs. soft preferences

A `diet`-category preference spans a wide range of seriousness, and the note needs to make that
range legible rather than flattening everything to the same tone. "Peanut allergy" and "prefers to
eat mostly vegetarian but isn't strict about it" are both diet preferences, but the first has to be
unmissable to anyone planning a meal or an activity involving food, while the second is a
lean-toward, not a rule. Use `weight` as the signal, not the wording alone — a traveler describing
an allergy in mild language ("I try to avoid shellfish") should still be recorded and treated at
`weight: 1` if it's medically an allergy, not downgraded because the phrasing was soft.
`dietSummary` leads with anything matching an allergy/intolerance pattern specifically so it can
never get buried under a longer list of softer food preferences.

Never infer a diet restriction that wasn't stated. A traveler's name, nationality, or home country
is not a signal for what they eat — the only source of truth is what they (or someone recording on
their behalf) actually put in `traveler_preferences`.

## Mobility: what "no long hikes" actually constrains

A `mobility` preference can range from a firm physical limitation (a wheelchair user, a recent
injury, a chronic condition affecting stamina) to a milder preference ("not a fan of steep stairs
but can manage a short flight"). The distinction matters concretely for the planner and packer
downstream: a hard mobility constraint should rule out a destination/activity outright when the
itinerary conflicts with it, while a soft one is a preference to accommodate where reasonably
possible, not an absolute limit. When recording or reading a mobility preference, keep the actual
words close at hand in `notes` — "can't do stairs" and "prefers to avoid stairs when there's an
elevator option" imply meaningfully different planning constraints, and collapsing them to the same
generic "mobility issue" note loses information the planner needs.

## When mobility and diet interact with pace

A hard mobility constraint often has pace implications the host should connect explicitly rather
than leaving implicit — a traveler who can't manage long walks likely also needs a slower overall
pace with more rest built in, even if they didn't separately record a `pace` preference. Don't
invent a `pace` row to capture this inference, but do connect the dots in the party note's prose
("Given [traveler]'s mobility note, the itinerary should avoid long walking days") so the planner
sees the implication without the host overstepping into writing a preference nobody stated.
