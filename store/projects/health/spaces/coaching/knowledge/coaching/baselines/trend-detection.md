# Trend detection

## Rolling averages smooth out single-day noise

A single reading — one bad night's sleep, one low-step day because the weather was awful — is not a
trend. `goalProgress`'s rolling average over the last (up to) 7 readings absorbs that kind of
one-off noise, which is exactly why the `checkin` action scores progress against it rather than
against the single most recent value. When fewer than 7 readings exist yet, the average is still the
right read (over however many there are) — just say so plainly rather than treating a 2-reading
average with the same confidence as a 7-reading one.

## Percent change over weeks, not days

`computeTrend` compares the first and last value of whatever window it's given — feed it the same
recent slice `goalProgress` used (oldest to newest) so "first vs. last" reads as "start of this
window vs. now", a couple of weeks of signal rather than a single day-over-day blip. A day-to-day
percent change on a noisy metric like weight or resting heart rate will swing wildly and mean very
little; a multi-reading window is what makes the percentage worth acting on.

## Distinguishing noise from a real trend

A small percent change (single digits) on a naturally noisy metric is well within ordinary
variation and shouldn't be reported as "trending" in either direction — say the goal looks roughly
flat rather than manufacturing a story out of rounding noise. A trend worth mentioning is one that's
both a meaningful percent change **and** consistent in direction across the window, not just a big
gap between two individually noisy endpoints. When in doubt, prefer the more conservative reading
("holding steady" over "improving") — overstating a trend that reverses next week costs more trust
than a cautious "not sure yet".

## How `checkin` uses it

The `checkin` action calls `computeTrend` on the recent slice of the metric feeding a goal and
compares its sign against which direction is actually "improving" for that goal (a target above the
current baseline improves by rising; a target below it, like a weight or resting-HR goal, improves
by falling). That comparison — not the raw trend number alone — is what decides whether a goal
still short of its target counts as "on track" (leave it alone) or "slipping" (propose a follow-up).
