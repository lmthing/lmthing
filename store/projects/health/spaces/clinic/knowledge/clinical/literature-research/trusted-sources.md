# Trusted sources

## Prefer guideline bodies and recognized medical references

- **Guideline bodies** — ACC/AHA (cardiology), NICE (UK), USPSTF (US preventive care), ADA
  (diabetes), and similarly recognized national/international bodies publish evidence-graded
  guidelines that are far more reliable than a single study or a summary blog.
- **Peer-reviewed journals** — findings reported in established journals (indexed on PubMed/NCBI)
  carry more weight than an uncited claim on a general health site, especially systematic reviews
  and meta-analyses over single small studies.
- **General medical references** — MedlinePlus (NIH), Mayo Clinic, Cleveland Clinic, and NIH/NCBI
  pages are reliable for plain-language overviews of a condition, test, or medication, and are
  usually the right level of detail for a user-facing summary.

## Weigh, don't just accept, the `sources` table

The `sources` table's `trust` field (0..1) reflects how much weight the user or the app has
assigned a given domain/guideline/query. Treat a high-trust source as a strong prior for relevance
and reliability, but still read what it actually says — a high-trust source's general
guideline doesn't automatically apply cleanly to every specific `topic` the researcher is asked
about.

## Deprioritize

Random blogs, forums, unsourced "wellness" content, and pages that themselves don't cite a
primary source. These can still surface useful search terms or context, but should not be the
basis for a claim in the final write-up — trace back to a primary/reputable source before citing.

## When reputable sources disagree or are sparse

Say so plainly rather than picking one silently — "guideline bodies differ somewhat on this
threshold" is more honest and more useful than presenting one number as settled fact. When the
literature is genuinely sparse or preliminary for a topic, say that too rather than overstating
confidence.
