# Sequencing multi-leg journeys and overnight tradeoffs

## Buffer time between legs

A leg's `durationMinutes` should cover door-to-door time, not just the moving segment — but when
two legs chain on the same day (a train into a hub city, then a same-day flight onward), add
explicit transfer buffer beyond each leg's own duration: at least 60-90 minutes between a domestic
train arrival and a subsequent flight departure at the same city, more if the train station and
airport aren't co-located and require a transfer of their own. A chain that looks fine on paper
(train arrives 14:00, flight departs 16:00) can be genuinely tight once transfer time, check-in
cutoffs, and security are counted — flag this in `notes` rather than assuming the traveller will
work it out.

## When one long leg beats two connecting ones

A single well-timed long leg is usually more reliable than two shorter legs with a tight
connection, especially across an international border where the second leg might require its own
check-in window. If `webSearch` turns up a direct option (a through train, a direct flight) even
at a modest cost premium over a connecting itinerary, that premium is often worth surfacing as the
recommended option rather than defaulting to whatever's cheapest — a missed connection can cost
far more in lost time and stress than the fare difference. Note both options when found, but be
explicit about which is more robust.

## Overnight and red-eye tradeoffs

An overnight train or red-eye flight can look efficient on paper — it "saves a day" by moving
during sleeping hours — but it has real costs worth naming in `notes`: the traveller typically
arrives tired and loses the first half of the following day to recovery, which should factor into
how the day after an overnight leg gets scheduled (light activities, no early must-do). Overnight
options are a genuinely good fit when the alternative is losing a full waking day to a daytime
transfer, when the route has a well-regarded overnight service (many European sleeper trains,
certain long-haul red-eyes with lie-flat options), or when the trip is time-constrained enough that
the day saved outweighs the recovery cost. They're a poor fit for a short trip where the traveller
can't afford to write off part of the next day, or when the overnight option searched turns up as
notably more expensive or lower-quality (a bus with no reclining seats marketed as "overnight",
for instance) than the daytime alternative.

## Ordering when more than two destinations are involved

When planning legs across three or more destinations, sequence bookByDate reminders in the order
the traveller will actually need to act — the earliest-departing leg's booking window comes first,
not the order destinations were listed in the brief. If two legs have overlapping booking windows
(both should ideally be booked in the same week), say so in one of the two `notes` fields so the
traveller can batch the booking session rather than discovering the second deadline later.
