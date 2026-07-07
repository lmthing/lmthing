# Mode tradeoffs

## Transit, walk, bike, and drive don't scale together

A commute that's a pleasant 12-minute bike ride can be a miserable 40-minute bus-with-a-transfer, and
a "10 minutes by car" trip can be genuinely unworkable by transit if it crosses a river or highway
with no direct line. Each `commuteTargets` entry states ONE mode the user actually cares about for
that target — respect it rather than substituting a mode that happens to produce a better-looking
number. If a `webSearch` for the requested mode comes back weak but a different mode's route is easy
to find, don't quietly swap modes; note the difficulty honestly instead.

## Drive-mode commutes need a time-of-day caveat

Transit schedules are relatively stable across a day; driving is not — a 15-minute drive at 10am can
be a 35-minute crawl at rush hour, which is when most commutes to an office/school target actually
happen. When estimating a `mode: 'drive'` commute to a workplace-like target, search for or reason
about a typical WEEKDAY RUSH-HOUR time rather than an off-peak figure, and say so in `basis` — a
drive estimate that quietly assumes Sunday-morning traffic conditions will mislead a user weighing a
daily commute.

## Walk and bike are the most straightforward, and the most honest about distance

Walk and bike times scale close to linearly with real routed distance (unlike transit, which has
fixed overheads from waits and transfers), so a `webSearch`-grounded estimate for these modes tends
to track a straight-line-plus-routing-factor fairly well. That said, still ground the actual number in
a search rather than a mental distance/speed calculation — a river, a highway, or a steep hill can
turn a "should be a 10 minute walk" distance into 25 real minutes, and only a real route check catches
that.
