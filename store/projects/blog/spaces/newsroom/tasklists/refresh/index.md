---
input: {}
---

Refresh every active source end-to-end: load which sources are active and which URLs are already
known, fetch each source in parallel (`rss` via `webFetch` + `parseFeedEntries`, `search` via
`webSearch`), and record only genuinely new items as `raw_items`. Never fabricate a title, URL, or
excerpt that wasn't actually fetched — a source that fails to fetch is skipped, not padded with a
placeholder item.
