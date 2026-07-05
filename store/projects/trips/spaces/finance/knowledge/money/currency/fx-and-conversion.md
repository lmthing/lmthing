# Reading FX quotes and converting correctly

## Direction matters — base, quote, and which way the rate goes

A `currency_rates` row's `rate` is "how many units of `quote` one unit of `base` buys." A row with
`base: 'EUR'`, `quote: 'USD'`, `rate: 1.08` means 1 EUR buys 1.08 USD — to convert a EUR amount into
USD, multiply by the rate; to go the other direction (USD into EUR), you'd divide by it, or better,
look for (or search for and cache) the inverse pair directly rather than assuming the mental
division is exact, since real published EUR→USD and USD→EUR rates aren't perfectly reciprocal once
spread is involved. Getting the direction backwards is the single easiest FX mistake to make
silently — always sanity-check that the converted number is the right order of magnitude for the
currencies involved before writing it anywhere.

## Freshness: prefer the newest cached rate, don't average

When more than one `currency_rates` row exists for the same `base`/`quote` pair (the cron refreshes
it periodically), always use the one with the latest `fetchedAt` — FX rates genuinely move day to
day, and averaging an old rate with a new one produces a number that was never actually quoted
anywhere. `convertAmount` already picks the newest matching row; don't second-guess it by manually
blending an older cached value back in.

## Searching for a rate worth caching

When `webSearch`ing "1 &lt;base&gt; to &lt;quote&gt; exchange rate," prefer a result from a
recognizable source — a central bank, a major financial data site, a well-known currency-conversion
page — over a random forum post or an outdated-looking cached search snippet. Record that source
name in `currency_rates.source` along with (implicitly, via `fetchedAt`) when it was captured, so a
traveller questioning a number later can see exactly where it came from. If the search results are
ambiguous, contradictory, or clearly stale, it's better to skip caching that pair for this run than
to write a rate you're not confident in — a missing rate falls back to a clearly-labelled 1:1 (see
below), which is honest about its own uncertainty in a way a wrong cached rate is not.

## The labelled 1:1 fallback

`convertAmount` returns the amount unchanged when no matching rate is cached for a pair — this is
the treasurer's explicit "never fabricate a rate" guardrail, not a shortcut. When presenting a
converted total that used this fallback, say so: "≈€340 (rate not yet available — shown as-is, not
converted)" is honest; silently presenting an un-converted EUR amount as if it were USD is not.
Once `refresh-rates` catches up and caches a real rate for the pair, subsequent conversions use it
automatically.
