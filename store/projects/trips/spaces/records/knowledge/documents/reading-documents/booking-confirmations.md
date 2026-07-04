# Booking confirmations

## What a confirmation actually contains

Airline, hotel, and car-rental confirmations are the closest thing to a structured document the
analyst ever sees, but the structure lives in prose conventions, not a consistent schema. Reliably
present, in some form, are: a **confirmation or reference code** (airline PNRs are typically a
6-character alphanumeric string; hotels use a longer numeric or mixed booking number; car rentals
often show both a reservation number and a separate confirmation number — when both are present,
the confirmation number is the one to store), a **provider name** (the airline, hotel brand, or
rental company — watch for the aggregator/OTA name appearing above the actual provider name; store
the operating provider, not the booking site), and **one or two anchor dates** (departure/arrival
for a flight, check-in/check-out for a hotel, pickup/return for a car).

Cost is present far less consistently than the above three. A hotel confirmation often shows a
nightly rate, taxes/fees, and a total — store the total actually charged, not the nightly rate,
and note in the extraction if the total is pre-tax vs. post-tax when the text distinguishes them.
A flight confirmation frequently omits cost entirely (especially for award/points bookings, or
when forwarded from a corporate travel tool that strips pricing) — an absent cost is not an error;
leave `bookings.cost` at its default rather than inventing a plausible fare.

## Date and timezone traps

This is where a confident-looking extraction most often goes quietly wrong:

- **Local time, not booking time.** A flight confirmation's departure/arrival times are in each
  airport's local timezone, not the traveller's home timezone or UTC. A red-eye that departs at
  23:40 and arrives the next calendar day at 06:15 local time is easy to misdate by a day if the
  arrival date isn't read carefully — the confirmation text usually spells out "+1 day" or shows
  the full date next to the arrival time specifically to prevent this; don't assume same-day.
- **Check-in/check-out vs. stay dates.** A hotel's `startAt`/`endAt` should reflect the check-in
  and check-out dates, not the date the reservation was made or confirmed (which is often the only
  date prominently shown at the top of the email).
- **Ambiguous numeric date formats.** `03/04/2027` is March 4th in a US-formatted confirmation and
  April 3rd in most everywhere-else formats. Use surrounding context (a spelled-out month elsewhere
  in the same document, the airport/hotel's country, the day of week if stated) to disambiguate
  rather than guessing the traveller's home format. When genuinely ambiguous and consequential,
  prefer leaving a note over silently picking one interpretation.
- **Multi-night vs. single-date stays.** A hotel confirmation for a 4-night stay should produce
  `startAt`/`endAt` spanning the full stay, not just the first night — re-read the text for an
  explicit "X nights" or check-out date rather than assuming one night when only check-in is
  prominent.

## Linking to an existing itinerary

When a destination for the booking's location/date range already exists in `destinations`, link the
booking to a same-day `itinerary_items` row (`kind: 'transit'` for a flight/car, `'lodging'` for a
hotel) via `bookingId`, so the traveller sees the reservation on their day plan rather than only in
a separate bookings list. When no matching destination exists yet, the booking still gets written —
linking to the day plan is a nice-to-have, not a precondition for recording the reservation itself.
