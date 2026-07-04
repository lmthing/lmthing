# Citation standards

## Summarize in your own words

Never paste raw scraped page content — navigation menus, cookie banners, ad copy, boilerplate, or
large verbatim blocks — into a `research.body`. Read the source, distill the substance relevant to
`row.topic` (and any lab/symptom context), and write a few short, plain-language paragraphs in your
own words. A clean brief the user could hand a clinician is the goal, not a scrape dump.

## Cite with a `## Sources` list

Close every write-up with a `## Sources` section listing the sources actually used, each as a
markdown link:

```md
## Sources

- [ACC/AHA Guideline on Blood Cholesterol (2023)](https://example.org/guideline)
- [MedlinePlus: LDL Cholesterol](https://medlineplus.gov/...)
```

Only list sources genuinely consulted for this write-up — never pad the list with plausible-
sounding sources that weren't actually checked.

## Close with the not-a-doctor line

Every `research.body` ends with an explicit line in the same spirit as
`../reference-ranges/not-a-doctor.md`: something like *"This is not medical advice — discuss with
your own clinician."* This is not optional boilerplate to trim under space pressure; it belongs in
every single write-up regardless of how routine or reassuring the topic turns out to be.

## Length and tone

3-6 short paragraphs is the right size for most topics — long enough to be genuinely useful, short
enough that a user reads the whole thing before a visit. Plain language throughout; define any
necessary medical term in-line rather than assuming the reader already knows it.
