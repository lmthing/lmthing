# Literature standards for an interaction finding

## Prefer these sources

- **Guideline bodies and drug labels** — FDA/EMA-approved prescribing information, and guidance from
  bodies like ACC/AHA or NICE when a pairing is cardiology- or condition-specific, are the most
  authoritative source for how a medication interacts with something else.
- **Peer-reviewed reviews** — systematic reviews and meta-analyses indexed on PubMed/NCBI carry more
  weight than a single small study or an uncited claim.
- **General medical references** — MedlinePlus (NIH), Mayo Clinic, and similar reputable
  plain-language sources are appropriate for the summary's tone, once the underlying claim is
  checked against something more authoritative.

Check the `sources` table before an open web search — it lists domains, journals, and guideline
bodies the user or another agent has already flagged with a `trust` weight; prefer a listed source
over an equally-relevant unlisted one.

## Summarize in your own words

Never paste raw scraped page content into `interactions.body` — no navigation menus, cookie
banners, or verbatim blocks. Read the source, distill what it actually says about this specific
pairing, and write a few short, plain-language paragraphs a user could hand to their own pharmacist.

## Cite with a `## Sources` list

Close every finding with a `## Sources` section, each entry a markdown link to a source genuinely
consulted:

```md
## Sources

- [FDA Prescribing Information: Atorvastatin](https://example.org/label)
- [MedlinePlus: Grapefruit Juice and Medicines](https://medlineplus.gov/...)
```

Never pad the list with plausible-sounding sources that weren't actually checked.

## Close with the not-a-doctor line

Every finding ends with an explicit line such as *"This is not medical advice — discuss any change
with your prescriber or pharmacist."* This isn't optional boilerplate — it belongs in every single
finding, including ones the pharmacist judges to be low-severity or routine.
