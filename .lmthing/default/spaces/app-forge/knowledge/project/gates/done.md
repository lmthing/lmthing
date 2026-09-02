## The done-gate — what must be true before an iteration is called done

An iteration is done when the app is PROVEN, not merely written. Every gate below is a finding list, never a verdict; an empty finding list is the only pass.

1. **Whole app clean** — `validateAppViews` reports no page that no navigation reaches, no nav target that is not a route, no page without a data-bound section, no malformed spec, and no unused component left as a warning you chose to ignore.
2. **Live data, not structure** — `renderSmokeViews` measured every page on real rows: no empty render, no always-null binding, and no page left `unmeasured` (coverage `null` means nothing could be checked — it is not a pass and not 100%).
3. **Endpoints hold** — every handler answers its declared contract; a section's endpoint Output satisfies that section's bindings, and one section calls one endpoint.
4. **The typed boundary held** — no `any` in or out of a handler, list fields typed structurally, `@app/types` imported rather than re-declared.
5. **Convergence held** — the pass touched only what the findings named; nothing unrelated was reshaped.

What the gate is FOR: typecheck and save-time validation both pass on a page that renders NOTHING — structure proves resolution, only the live tier proves content. Report honestly instead: anything still broken is carried forward as named findings for the next iteration, never folded into a clean report.

Grounded: `org/docs/format/project/pages/view-spec.md` (the three validation tiers and their findings).
