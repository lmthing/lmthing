# View-spec element-catalog completeness audit

**Wave 0 · Agent AUDIT · 2026-07-29 · blocking gate for pinning `sdk/org/libs/cli/src/app/view-spec/schema.ts`**

Scope: every hand-built component in the 5 catalog apps (`store/projects/{blog,health,homes,kitchen,trips}`)
mapped, on paper, to the plan's v1 element catalog (~26 elements + the `format:` modifier). Paper
exercise only — no engine code, nothing under `store/projects/` or `sdk/org/` was modified.

Floor cross-checked against `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx` (42 descriptor
types, already native-tested via `sdk/org/libs/ui/metro/suites/descriptor.tsx`) **and** against the
shipped element library `sdk/org/libs/ui/src/elements/` — which turns out to carry far more of the
catalog than the plan credits.

---

## 1. The real component count

The plan's "140 surveyed hand-built components" is **exactly right** as a count of top-level
`components/*.tsx` files, and I reproduce it to the file:

| app | `components/*.tsx` files | distinct exported visual components | components LOC |
|---|---|---|---|
| blog | 23 | 26 | 1,811 |
| health | 38 | 44 | 2,132 |
| homes | 22 | 23 | 1,996 |
| kitchen | 28 | 29 | 2,132 |
| trips | 29 | 31 | 1,905 |
| **total** | **140** | **153** | **~9,976** |

Two corrections to the plan's framing, both worth carrying forward:

- **140 files, 153 components.** Nine files export more than one visual component
  (`health/components/states.tsx` alone exports 7; the three `Skeleton.tsx` files export 3 each;
  `blog/components/EmptyState.tsx` and `homes/components/ListingCardSkeleton.tsx` export 2 each).
  Every count below is against **153**.
- **A sixth app exists but has no components.** `store/projects/demo-feed/` ships 0 components; the
  survey correctly covers 5 apps.

Not counted in the 140, and deliberately out of this audit's frame: **33 space-level
`spaces/*/components/{view,ask}/*.tsx`** across the same 5 apps. These are agent-`display()`
descriptors rendered by `render-descriptor.tsx`, not page UI — a different pipeline. I read a
representative sample (`kitchen/spaces/chef/components/view/WeekPlanCard.tsx`,
`homes/spaces/scout/components/ask/TasteQuiz.tsx`, plus 4 others): all are 16–55 LOC
`surface > col[row[text, badge], …]` shapes, uniformly expressible, and already have a renderer.
Total `.tsx` under any `components/` directory in the catalog: **173**.

---

## 2. The structural finding: 47 of 153 components disappear before any mapping

This is the single most important number in the audit, and it runs **opposite** to catalog inflation.
Four whole cohorts are not model-authored UI at all under the spec model — they are renderer
built-ins or modifiers already in the plan. They cost the model **zero** vocabulary tokens:

| cohort | components | LOC | what absorbs it | plan reference |
|---|---|---|---|---|
| loading / empty / error / pending states | **26** | ~1,050 | renderer defaults | B2: "Supplies loading/error/empty … omissions become defaults, not gaps" |
| markdown renderers (`MarkdownBody.tsx` ×5) | **5** | **1,435** | `markdown` element | B1 catalog |
| icon sets (`icons.tsx` ×5) | **5** | 1,020 | `icon` (named set) | B1 catalog |
| formatters (`format.ts` ×5, not in the 153) | — | ~250 | `format:` modifier | B1: "absorbing the 5/5-apps `format.ts`" |
| trivially-repeated status pills (`FlagBadge`, `SeverityBadge`, `UrgencyBadge`, `StatusChip`, `CurrencyBadge`, `TopicWeightBadge`, `MacroBadge`, `AlertBadge`, `ScoreBadge`†) | **9**† | ~250 | `badge` + `tone` | A1 below |
| **total removed from the vocabulary problem** | **≈47 (31%)** | **~3,750** | | |

† `ScoreBadge` needs `meter variant='ring'` (A5), the others are pure `badge`.

The 26-component state cohort deserves calling out precisely, because three of the five mapping
passes reported "GAP: new element `skeleton`" / "GAP: new element `spinner`" and **all of them are
wrong**: `SkeletonLine`/`SkeletonRow`/`SkeletonList`/`Spinner`/`EmptyState`/`ErrorNote`/`ErrorState`/
`AIWorking` are exactly the states B2 says the renderer supplies. The model never writes them; there
is no `skeleton` or `spinner` token in the catalog and there should not be one. `AIWorking`
(`health/components/states.tsx`) is the renderer's presentation of the plan's
`async{note, refetchAfter}` — the "This page updates automatically" copy is literally already there.

**Every one of the 47 is EXPRESSIBLE-BY-CONSTRUCTION.** The mapping problem is the remaining **106**.

---

## 3. Descriptor floor cross-check — what already exists vs what UI-RENDERER must build

The plan says the floor is `render-descriptor.tsx`. That is true but understated: `libs/ui/src/elements/`
already ships token-styled, **native-forked** implementations of much of the catalog. Cost signal for
the Wave-1 UI-RENDERER agent:

| catalog element | in `render-descriptor.tsx` | in `libs/ui/src/elements/` (native fork?) | build cost |
|---|---|---|---|
| `row` | `row`/`inline` | `primitives/row` (**native**) | free |
| `col` | `stack` | `primitives/col` (**native**), `layouts/stack` | free |
| `grid` | `columns` (equal-width, from child count) | — | **low** — needs explicit column count + responsive collapse |
| `spacer` | `spacer` | — | free |
| `divider` | `divider` (with `label`) | `content/separator` | free |
| `surface` | `card`/`panel` (with `title`) | `content/card`, `content/panel` | free |
| `heading` | `h1`–`h4`/`heading` (`level`) | `typography/heading` | free |
| `text` | `text` (`bold`/`dim`/`italic`/`color`) | `primitives/text` (**native**) | free |
| `caption` | `muted` | `typography/caption` | free |
| `code` | `code`, `codeblock` | `typography/code`, `content/code-block` | free |
| `markdown` | `markdown` | `content/markdown` | free |
| `quote` | `quote` | — | free |
| `badge` | `badge`/`tag`/`pill` (one case — `color` prop) | `content/badge` | free |
| `chip` | (same case as badge) | — | **see A0 — recommend cutting** |
| `statcard` | `statcard` (`label`/`value`/`delta`) | — | free |
| `meter` | `progressbar` (linear only) | — | **low** — needs `variant` (A5) + `tone` (A1) |
| `keyvalue` | `keyvalue` (`pairs`) | — | free |
| `table` | `table` (`columns`/`rows`) | `primitives/table` (**native**) | free |
| `timeline` | `timeline` (`items:{title,time,detail}`) | — | free |
| `avatar` | — | `content/avatar` | free — **but 0 demand, see A0** |
| `rating` | — | — | **medium** — build (4 components demand it, 3 interactive) |
| `image` | `image`/`img` | `primitives/image` (**native**) | free |
| `icon` | — | `primitives/icons` (**native**) | **medium** — needs a curated named set (§3.1) |
| `map` | — | — | **medium** — **recommend cutting, see A0** |
| `banner` | `callout`/`alert`/`banner` (`variant`) | — | free |
| `empty` | — | — | **low** — renderer default, `icon+title+hint+actions[]` |
| `button` | — (deliberately inert) | `forms/button`, `primitives/pressable` (**native**) | **high** — the action/dispatch model does not exist anywhere yet |
| `link` | `link` (hardcoded `target=_blank`) | `primitives/link` (**native**) | **low** — needs an internal-`navigate` form |

**19 of 26 exist in some renderable form; 7 need real work** (`grid`, `meter` variants, `rating`,
`icon` set, `map`, `empty`, `button`). Only `button` is genuinely expensive, and it is expensive for
the right reason: `render-descriptor.tsx:201` deliberately renders form controls inert
("there is nothing to submit it to"), so the entire action/dispatch/invalidation seam is new. That is
B4's work, not an element gap.

Also free and already native-tested but **not in the v1 catalog**, worth knowing about:
`details` (collapsible — relevant to A3), `list`/`listitem`, `spinner`, `kbd`, `audio`, `strong`/`em`.
And in `libs/ui/src/elements/`: `overlays/{dialog,dropdown,sheet,context-menu}` (all four **native-forked**),
`nav/{tab-bar,bottom-tabs,bottom-nav,top-bar,sidebar,breadcrumb}`, `layouts/split-pane`,
`forms/{input,select,textarea,button,settings-schema-form}`, `primitives/scroll` (**native**),
`primitives/form` (**native**). The renderer's archetype/shell prediction and A2/A4 below all land on
existing, native-proven parts.

### 3.1 The `icon` named set — sized from the survey

The 5 apps hand-wrote **1,020 LOC of inline SVG**. Distinct glyph names across the four
per-export icon files: **67**. `blog/components/icons.tsx` independently invented the exact model the
plan proposes — a single `Icon({name})` with a `PATHS: Record<IconName, ReactNode>` and a
**24-name union**. That is the strongest single precedent in the survey for a curated named set, and
24–67 is the empirical size band for v1. (Reminder from the native gates: lucide is web-only, so the
set must be SVG primitives via `primitives/svg.native.tsx`.)

---

## 4. Full mapping — the 106 non-trivial components

Verdicts reconciled across the five passes. `EXPR` = expressible in the v1 catalog as written;
`A<n>` = expressible **after** amendment n from §5; `OOS` = out of scope.
Trees are compact: `surface > col[ row[heading, badge], text ]`.

### 4.1 blog (26 components)

| component | LOC | element tree | verdict |
|---|---|---|---|
| AlertRow | 47 | `row{rowAction:mutate} > col[ row[badge, text], caption, link ]` | EXPR |
| AnnotationItem | 49 | `surface > col[ quote, text, row[ row[badge, row[icon, caption]], button ] ]` | EXPR |
| ArticleCard | 170 | `surface > row[ link>image, col[ row[ col[caption, link], row[meter, badge, icon] ], text{maxLines}, row[badge, caption{relative-time}], quote, row[link×tags, caption], row[button, link, button] ] ]` | A8 |
| ArticleTakes | 108 | `surface > col[ row[icon, caption], row[button×3{reveals}], surface[ banner \| markdown \| caption ] ]` | A3, I4 |
| BriefingCard | 39 | `link > col[ row[text, badge], text{maxLines}, caption ]` | A8 |
| CollectionCard | 41 | `link > col[ row[text, badge], text{maxLines}, row[caption, caption] ]` | A8 |
| DigestCard | 46 | `link > col[ row[text, badge], text{maxLines}, row[badge, caption] ]` | A8 |
| InsightsPanel | 84 | `col[ row[statcard×3], surface>col[heading, col[ row[caption, meter, caption] ]]×3 ]` | EXPR |
| NewsletterView | 31 | `surface > col[ row[heading, caption{date}], markdown ]` | EXPR |
| RelevanceMeter | 31 | `meter{variant:'segments', segments:3}` | A5 |
| SearchResults | 69 | `col[ col[heading, text \| col[link×n]]×3 ]` | EXPR |
| SourceHealthBar | 79 | `surface > col[ row[text, badge], meter{tone}, row[caption, caption], caption ]` | A1 |
| SourceRow | 76 | `row[ col[ row[badge, text, badge], caption, row[badge×n] ], row[caption, button, button] ]` | EXPR |
| StatsStrip | 50 | `col[ row[statcard×4], row[badge{navigate}×n] ]` | EXPR |
| SubscriptionRow | 70 | `row[ col[text, caption, row[badge, badge]], row[field{toggle}, button] ]` | A2 |
| TopicChip | 108 | `row[ col[ row[link, badge, badge, caption], row[meter, field{stepper}, caption] ], row[button×3] ]` | A2 |
| TopicWeightBar | 25 | `row[ caption, meter, caption{number} ]` | EXPR |
| AddToCollectionMenu | 66 | `col[ button{reveals}, surface > col[text, empty?, row[text, button]×n, caption] ]` | A3 (reshaped from popover) |
| MarkdownBody | 261 | `markdown` | §2 |
| Icon (icons.tsx) | 214 | `icon` | §2 |
| EmptyState, ErrorState, ArticleCardSkeleton, FeedSkeleton, ListSkeleton, Spinner | 143 | renderer defaults | §2 |

### 4.2 health (44 components)

| component | LOC | element tree | verdict |
|---|---|---|---|
| AdherenceBar | 31 | `col[ row[caption, text], meter{tone}, caption ]` | A1 |
| AppointmentCard | 29 | `surface > col[ row[heading, badge], caption, text?, caption{date} ]` | EXPR |
| AppointmentRow | 32 | `row{rowAction:navigate}[ col[text, caption{date}], badge ]` | EXPR |
| AttentionStrip | 88 | `row{scroll:'x'}[ surface{rowAction:navigate} > col[ row[icon, badge?], col[text, caption], row[text, icon] ] ×n ]` | A4 |
| CareShareCard | 30 | `row{rowAction:navigate}[ col[text, caption{date}], badge ]` | EXPR |
| ContactCard | 21 | `surface > col[ row[heading, badge], caption?, text×2, caption? ]` | EXPR |
| Disclaimer | 11 | `banner{tone:'warn'} > text` | EXPR |
| DocumentRow | 40 | `row{rowAction:navigate}[ col[row[text, badge], caption{date}], badge ]` | EXPR |
| DoseChecklist | 41 | `col[ row[ col[text, caption], button{mutate} ] ×n ]` | EXPR |
| DoseRow | 30 | `row[ col[text, caption{date}, text?], badge ]` | EXPR |
| EmergencyContact | 62 | `banner{tone:'error'} > col[text, link{href:'tel:…'}]` \| `link > row[icon, text]` | A10 |
| ExplainPlainly | 49 | `col[ button{reveals}, chat-section ]` | A3 + `chat` section |
| ExtractionList | 28 | `col[ row[text, badge] ×n ]` \| `empty` | EXPR |
| FollowupRow | 42 | `row[ col[row[text, badge], caption?, caption{date}], button{mutate} ]` | EXPR |
| GoalCard | 47 | `surface > col[ row[heading, badge], caption?, meter, text, caption{date}? ]` | EXPR |
| HealthStats | 45 | `row[ statcard{tone}×5 ]` | A1 |
| InsightCard | 32 | `surface > col[ row[badge, caption?], markdown, caption{date} ]` | EXPR |
| InteractionCard | 26 | `surface > col[ row[heading, badge], markdown ]` (pending → renderer state) | EXPR |
| KnowledgeNoteCard | 24 | `surface > col[ row[heading, badge], text, row[caption, caption] ]` | EXPR |
| LabRow | 29 | `row{rowAction:navigate}[ col[text, caption], badge ]` | EXPR |
| MedicationDetail | 41 | `col[ row[heading, badge], keyvalue ]` | EXPR |
| MedicationRow | 44 | `row{rowAction:navigate}[ col[row[text, badge], caption, caption{date}], icon ]` | EXPR |
| SymptomRow | 38 | `row[ col[row[text, badge?], caption], rating{max:5, readonly} ]` | EXPR |
| TodayPlan | 155 | `col[ row[icon, col[text, caption], button{mutate}]×doses, …×followups, row{rowAction:navigate}×appts ]` | EXPR |
| TriageCard | 31 | `surface{tone} {rowAction:navigate} > row[ col[text, caption], badge ]` | A1 |
| VisitBriefCard | 44 | `surface > col[ row[heading, row[badge, button{print}]], caption{date}?, markdown ]` | A11 |
| ImportForm | 65 | `create` section (Input schema → select + textarea) | EXPR (§5.0) |
| UploadForm | 74 | `create` section (select + input + textarea; **not** a file picker) | EXPR (§5.0) |
| QuickLogCard | 268 | `create` section + `list{selectable}` over `draft.proposedActions` + bulk `button{mutate}` + `poll` | **A2, I4, I5** |
| MetricChart | 80 | hand-rolled SVG polyline + area + endpoint dot | **OOS** |
| AssistantDock | 79 | `shell.assistant` dock wrapping the `chat` section | A9 |
| FlagBadge / SeverityBadge / UrgencyBadge / StatusChip | 74 | `badge{tone}` | A1 / §2 |
| MarkdownBody, icons | 344 | `markdown`, `icon` | §2 |
| SkeletonLine/Row/List, EmptyState, ErrorNote, AIWorking, Spinner | 206 | renderer defaults | §2 |

### 4.3 homes (23 components)

| component | LOC | element tree | verdict |
|---|---|---|---|
| AlertStrip | 67 | `col[ row[icon, col[text, text, link], button{mutate}] ×n ]` | EXPR |
| CaptureRow | 89 | `surface{tone} > col[ row[badge, caption{date}], caption, text, banner{error}>col[text, button], markdown ]` | A1 |
| CommuteChips | 41 | `row[ badge{tone}×n ]` | A1 |
| CompareTable | 95 | `surface > table{stickyFirstColumn, cellTone}` — winner logic → endpoint Output | A1 + A4 |
| FeedToolbar | 88 | section-level `facet{counts}` + `sort` — not an element at all | **I3** |
| FlagChips | 41 | `row[ badge{tone, icon}×n ]` | A1 |
| ListingCard | 159 | `surface > col[ row[col[link, row[text, text]], meter{variant:'ring'}], row[text{currency, strike}, text{currency}], row[text×4], banner{warn}?, row[badge×n]×2, text{maxLines}, row[button{mutate}, button{reveals}] , field{text}+button{mutate} ]` | **A1, A2, A3, A5, A8** |
| LocationGuessPanel | 42 | `surface > col[ row[icon, heading], text, image{tileUrl from endpoint}, markdown, link{external} ]` | A0(map→image) |
| NeedsYouNow | 155 | `col[ row[icon, heading], row{scroll:'x'}[ surface > col[row[icon, caption], link, text, row[link, button{mutate}, button{reveals}], field{text}+button{mutate}] ×n ] ]` | **A2, A3, A4** |
| ScoreBadge | 53 | `meter{variant:'ring', tone}` | A5 |
| SearchCard | 115 | `surface{rowAction:navigate} > col[ row[text, badge], text, text{currency}, row[badge×3, field{toggle}], text ]` | A2 |
| SearchSwitcher | 73 | shell nav — `button{reveals}` + list | A3 (reshaped from popover) |
| SearchTabs | 60 | `row[ link{active}×n ]` (route-driven, not local tabs) | EXPR |
| StaticMap | 87 | `image` + positioned pin/radius overlay; Mercator math → endpoint Output | A0 / **partial OOS** |
| TasteNoteCard | 26 | `surface > col[ row[badge, caption], markdown, meter ]` | EXPR |
| TrueCostBreakdown | 75 | `surface > col[ heading, keyvalue{currency}, divider, row[text, text{currency}], col[text×n] ]` | EXPR |
| AlertsBell | 158 | shell nav — `button{reveals}` + `badge` count + list + `poll` | A3, I4 |
| ConciergeDock | 82 | `shell.assistant` dock wrapping the `chat` section | A9 |
| MarkdownBody, icons | 511 | `markdown`, `icon` | §2 |
| ListingCardSkeleton, ListingFeedSkeleton, Spinner | 44 | renderer defaults | §2 |

### 4.4 kitchen (29 components)

| component | LOC | element tree | verdict |
|---|---|---|---|
| AisleGroup | 31 | `surface > col[ heading, row[text, text{currency}]×n ]` | EXPR |
| CoverageRibbon | 54 | `surface > row[ icon, col[text, caption], link ]` | EXPR |
| ExpiringRow | 36 | `surface > row[ col[text, text], badge{tone} ]` | A1 |
| ImprovisePanel | 145 | `surface > col[ row[row[icon, col[heading, caption]], button{mutate}], banner{error}, row[image, col[text, row[caption×3]], badge \| button{mutate}]×n, caption ]` | EXPR |
| IngredientRow | 28 | `surface > row[ col[text, text], <slot> ]` | EXPR (slot = section `item` composition) |
| MacroBar | 36 | `col[ row[text, text], meter ]` | EXPR |
| MacroTriplet | 56 | `row[ col[text, caption]?, col[row[badge{shape:'dot'}, text], caption]×3 ]` | A0 (badge shape) |
| MealCell | 124 | `surface > col[ row[image, link, button{mutate}], row[field{rating}, badge \| button{mutate}] ]`; drag-reschedule → **OOS** | A2 + **OOS(dnd)** |
| OnboardingCard | 77 | `surface > col[ row[icon, col[heading, caption]], grid[link×2, button{reveals}], divider, row[button{mutate}, caption] ]` | A3 |
| PlanProgress | 45 | `col[ row[text, caption], meter ]` | EXPR |
| RatingStars | 34 | `field{kind:'rating', mutation}` | A2 |
| RecipeCard | 49 | `surface > col[ image, col[link, markdown, caption, row[badge×n]] ]` | EXPR |
| RecipePicker | 101 | `list{search}` inside a `reveals`-opened surface | A3 + section `search` |
| ShoppingRow | 43 | `surface > row[ field{toggle, mutation}, text{strike} ]` | A2 |
| StatsStrip | 54 | `row[ statcard{icon, tone}×5 ]` | A1 |
| SuggestionCard | 57 | `surface > row[ icon, col[caption, text, markdown], button{mutate} ]` | EXPR |
| Tabs | 45 | `toolbar` section `reveals` — not an element | A3 |
| TonightCard | 112 | `surface > col[ image, badge, col[row[link, caption], text, surface[MacroTriplet], row[badge \| button{mutate}, field{rating}]] ]` | A2 |
| WeekGrid | 101 | `grid{columns:'auto'}[ caption×days, caption(slot) + MealCell×days ×3 ]` + `scroll:'x'` | A4 + **OOS(dnd)** |
| CookingMode | 169 | fullscreen step-through: `col[ row[…], text{xl}, meter{variant:'segments'}, row[button{reveals}×2] ]` + wake-lock | A5 + **OOS(wake-lock/fullscreen)** |
| ImportForm, PasteImportForm, PreferencesForm | 263 | `create` sections (Input schema → fields) | EXPR (§5.0) |
| ConciergeDock | 88 | `shell.assistant` dock wrapping the `chat` section | A9 |
| MarkdownBody, icons | 559 | `markdown`, `icon` | §2 |
| Skeleton ×3, Spinner | 71 | renderer defaults | §2 |

### 4.5 trips (31 components)

| component | LOC | element tree | verdict |
|---|---|---|---|
| BookingRow | 66 | `row[ col[row[badge, text], caption×2], row[col[text, link{external}], button{mutate}] ]` | A10 |
| BudgetStrip | 52 | `keyvalue{layout:'inline'}` ×4 pairs, `format:'currency'` | A12 |
| CurrencyBadge | 9 | `badge` | §2 |
| DayColumn | 19 | `col[ heading, col[ItineraryCard×n] ]` | EXPR |
| DayTimeline | 103 | `timeline{items}` + `banner{warn}` for overlaps + `caption` gap markers; conflict/gap detection → endpoint Output | EXPR |
| DealCard | 57 | `surface > col[ row[col[text, badge], text{currency}], markdown, row[link{external}, field{select, mutation}] ]` | A2 |
| DestinationHeader | 32 | `row[ col[heading, caption×2], link ]` | EXPR |
| DocumentRow | 26 | `row{rowAction:navigate}[ col[text, caption], badge ]` | EXPR |
| ExpenseRow | 38 | `row[ col[text, row[badge, caption]], row[text{currency}, badge, button{mutate}] ]` | A7 (per-row currency) |
| FinanceBar | 30 | `col[ row[text, text{currency}], meter ]` | EXPR |
| ItineraryCard | 57 | `surface{tone} > col[ row[text, row[badge, button{mutate}]], caption×n, row[text{currency}?, badge?] ]` | A1 |
| NoteCard | 17 | `surface > col[ row[text, badge], markdown ]` | EXPR |
| PackingRow | 53 | `row[ row[field{toggle, mutation}, col[text{strike}, row[badge, caption]]], button{mutate} ]` | A2 |
| PreferenceRow | 36 | `row[ col[row[badge, text], caption], row[caption, button] ]` | EXPR |
| ReminderRow | 35 | `row[ col[text, caption{date}], text{tone} ]` | A1 |
| RunStrip | 75 | `row[ badge{tone, pulse}×n ]` + `poll` | A1, **I4** |
| SettlementRow | 25 | `row[ text, text{currency} ]` | EXPR |
| TransitLegRow | 44 | `surface > col[ row[text, badge], caption×2 ]` | EXPR |
| TravelerCard | 22 | `row{rowAction:navigate}[ col[text, caption], badge ]` | EXPR |
| TripCard | 34 | `col{rowAction:navigate}[ row[text, badge], caption, text{maxLines} ]` | A8 |
| TripTabs | 165 | shell nav: two-level route-driven tab bar + `scroll:'x'` | A4 + shell |
| DocumentUploadForm | 114 | `create` section (Input schema → textarea + input + select) | EXPR (§5.0) |
| CopilotDock | 70 | `shell.assistant` dock wrapping the `chat` section | A9 |
| MarkdownBody, icons | 566 | `markdown`, `icon` | §2 |
| EmptyState, ErrorState, Skeleton ×3, Spinner | 125 | renderer defaults | §2 |

---

## 5. Ranked catalog amendments

### 5.0 First, four corrections to the raw mapping passes

Recorded so Wave 1 does not inherit them:

1. **Form components are not element gaps.** `ImportForm`, `PasteImportForm`, `PreferencesForm`,
   `UploadForm`, `ImportForm`(health), `DocumentUploadForm` — **7 components** — are whole-page
   `create` sections whose fields are *derived from the endpoint's Input schema, never declared*
   (plan B1). No `input`/`select`/`textarea` element is needed for these. Note that
   `health/components/UploadForm.tsx` is **not** a file picker despite the name — no
   `<input type=file>`, no `FileReader` anywhere in the 5 apps.
2. **`timeline` is already in the v1 catalog.** `trips/DayTimeline` was reported as a new-element
   gap; it is not. `render-descriptor.tsx` already has a `timeline` case.
3. **The embedded `<Chat>` is the `chat` section kind**, not an out-of-scope element (4 apps).
4. **Skeleton / spinner / empty / error / AIWorking are renderer defaults** (§2), not elements.

### 5.1 Ranked amendments

Ranked by cross-app demand. "Demand" = surveyed components (of 153) that cannot be expressed without it.

| # | amendment | kind | demand | apps | in `render-descriptor`? | verdict |
|---|---|---|---|---|---|---|
| **A1** | **`tone` as a value-driven modifier on `badge`/`text`/`caption`/`meter`/`statcard`/`surface`, accepting a literal token, `'auto'`, or a declared `toneMap: {value → tone}`** | prop (widened) | **≈32** | 5/5 | partial — `badge.color`, `text.color`, `banner.variant`; **`progressbar` has none** | **ADOPT** |
| **A2** | **`field` — one interactive element with `kind: 'toggle'\|'rating'\|'select'\|'stepper'\|'text'`, `value:'$.x'`, `mutation`, `arg`** (inline per-row edit) | **new element (1)** | **12** | 5/5 | **no** — descriptor renders controls inert by design | **ADOPT** |
| **A3** | **`reveals: [id]` on `button`** (lift the existing section-level concept to element level) | prop | **11** | 5/5 | `details` case exists (native-tested) | **ADOPT** |
| **A4** | **`scroll: 'x'` on `row`/`grid`/`table`** | prop | **6** (+13 files with `overflow-x-auto`) | 4/5 | no — but `primitives/scroll` has a **native fork** | **ADOPT — native-correctness, not cosmetics** |
| **A7** | **`format:` enum widened to `date\|datetime\|time\|relative-time\|currency\|number\|percent\|humanize`, plus `currencyField: '$.currency'`** | modifier | **all 5 `format.ts`**; multi-currency in 2 apps | 5/5 | n/a | **ADOPT** |
| **A8** | **`maxLines` on `text`** | prop | **12** | 5/5 | no | **ADOPT** |
| **A5** | **`meter { variant: 'bar'\|'ring'\|'segments' }`** | prop | **4** (ScoreBadge→whole homes feed, RelevanceMeter, CookingMode, settlement) | 3/5 | `progressbar` = linear only | **ADOPT** |
| **A9** | **`shell.assistant: { agent }`** — the `chat` section as a persistent dock | shell field | **5** (4 docks + blog's `/assistant` route) | 5/5 | n/a | **ADOPT** |
| **A10** | **`link { external: true }`** and `href` scheme passthrough (`tel:`/`mailto:`) | prop | ~10 external, 1 `tel:` | 5/5 | descriptor **hardcodes** `target=_blank` — must become opt-in | **ADOPT (cheap)** |
| **A11** | **`button { action: 'print' }` and `{ copy: '$.field' }`** | action variants | **9** (7 print/export, 2 copy) | 4/5 | no | **ADOPT (cheap)** |
| **A12** | **`keyvalue { layout: 'inline' }`** | prop | 2 (BudgetStrip, MedicationDetail) | 2/5 | descriptor `keyvalue` is stacked rows | **ADOPT (trivial)** |
| A13 | `table { stickyFirstColumn }` | prop | 1 (CompareTable) | 1/5 | no | **DEFER** — 1/153; winner-highlighting is A1 + endpoint Output |
| A14 | `badge { shape: 'dot' }` | prop | 1 (MacroTriplet) | 1/5 | no | **DEFER** |
| A15 | `badge { overlay: true }` (over an image) | prop | 1 (TonightCard) | 1/5 | no | **REJECT — reshape** (place the badge below the image) |
| A16 | `popover` (anchored menu) | new element | 3 | 2/5 | no; `overlays/dropdown` exists native-forked | **REJECT — reshape to A3.** A phone has no anchored-popover convention, and 2 of the 3 (`AlertsBell`, `SearchSwitcher`) are shell nav, not page content. Re-open only if the judged procrustean rate flags it. |

### 5.2 …and what to CUT, to pay for it (net catalog size)

Every added token is a token the weak model must learn — so the audit also looked for tokens the
survey does **not** earn:

| element | demand in 153 components | recommendation |
|---|---|---|
| **`chip`** | 0 *distinct from* `badge` — every catalog "chip" is a pill-shaped badge; the only interactive chips (`FeedToolbar`) are a section-level `facet` control, not an element | **CUT** → `badge { shape: 'pill'\|'tag' }`. `render-descriptor.tsx:150` already collapses `badge`/`tag`/`pill` into ONE case. |
| **`avatar`** | **0** — zero avatar components; the `rounded-full` hits are all pills | **CUT** (re-promote when a person-centric app appears) |
| **`code`** | **0 standalone** — every `<pre>`/`<code>` in the catalog is inside a `MarkdownBody` | **CUT** → lives inside `markdown` |
| **`quote`** | 1 (`blog/ArticleCard` pull-quote); `trips/ItineraryCard`'s border-left is an accent stripe = A1 | **CUT** → `surface { tone }` + `text`, or keep at zero cost |
| **`map`** | 2, both `homes` — and `StaticMap` is *an `<img>` to `tile.openstreetmap.org`* whose Mercator math moves to the endpoint Output under the view-shaped-endpoint rule | **CUT** → `image` with an endpoint-computed tile URL. The pin/radius overlay is the only residual: **OOS**. |

**Net: 26 − 5 cut + 1 added (`field`) = 22 elements**, plus 8 widened props and a widened `format:`.
The v1 catalog gets *smaller* and strictly more capable.

---

## 6. Interactivity gaps, ranked

A visuals-only audit would have missed all of these. Ranked by demand; `I1` is the one that would
have been fatal.

| # | real interaction | demand | expressible in v1 as written? | proposal |
|---|---|---|---|---|
| **I1** | **inline per-row mutation carrying an argument** — checkbox toggle bound to a row field (`ShoppingRow`, `PackingRow`, `SubscriptionRow`, `QuickLogCard`), set-a-rating (`RatingStars`, `MealCell`, `TonightCard`), ± stepper (`TopicChip`), bound select (`DealCard`, `SearchCard`), reveal-then-submit-a-reason (`ListingCard`, `NeedsYouNow`) | **12** in 5/5 apps | **NO.** `button {mutate}` is argument-free | **A2 `field`** — one element, five kinds. **Blocking.** The plan's 139 mutations are the majority of the app surface, and this is how most of them are actually reached |
| **I2** | **element-level disclosure** — expand/collapse, dock open, menu open, reveal a sub-form | **11** (+21 files matching expand/collapse) | partially — `reveals` exists only at section level | **A3** — lift `reveals` to `button` |
| **I3** | **client-side sort + faceting with per-option counts** — `FeedToolbar` (4 sorts × 5 filters **with counts**), `blog/index` filter, 25 files with a `<select>` | 2 explicit toolbars, 5/5 apps use the pattern | `facet`/`search` exist; **`sort` does not, and `facet` has no counts** | add `sort: [{label, field, dir}]` and `facet: { field, counts: true }` to the `list` section |
| **I4** | **poll while an agent-produced row is pending** — `ArticleTakes` (2.5s), `QuickLogCard` (2.5s), `RunStrip` (adaptive 4s/15s), `AlertsBell` (30s) + 8 pages | **12 files** | `async{refetchAfter}` covers the *create* side only; a `list`/`detail` section has no poll | add `poll: { seconds, whileField: '$.pending' }` — a **named declarative policy**, not an expression (stays non-Turing-complete) |
| **I5** | **multi-select then bulk-commit** — `QuickLogCard` accepts N of M proposed actions; `homes/compare` selects N listings | 2 | **NO** | `list { selectable: true }` + `button { mutate, over: 'selection' }`. Two occurrences = the plan's own "two is a pattern" promotion bar; adopt in v1 or accept a first-occurrence promotion later |
| I6 | row click → navigate, **with a nested button inside** (`SearchCard`, `ListingCard` use `stopPropagation`) | ~20 rows, 2 with nesting | `rowAction` covers it | renderer detail: nested actions must not fire `rowAction`. Note for UI-RENDERER |
| I7 | keyboard shortcuts (`j/k/s/x`, arrows, Escape) | 4 files | no | **renderer/shell-owned**, never model-authored. `FeedToolbar` even advertises shortcuts it does not implement |
| I8 | print / export / copy-to-clipboard | 9 | no | **A11** |
| I9 | drag-and-drop reschedule | 2 (`MealCell`, `WeekGrid`) — 1 app | no | **OOS** (confirmed). Reshape available: the `+ add` / `remove` buttons already exist; reschedule becomes `field{select}` over day/slot |
| I10 | **pagination** | **0** | — | **Confirms `limit`-only.** Zero `Load more` / `hasMore` / `setPage` across 153 components *and* 84 pages |
| I11 | **true optimistic UI** | **0** | — | **The plan's "one honest v1 loss" costs nothing.** No app does an optimistic swap; all use `invalidates` cache-invalidation (`NeedsYouNow`, `TodayPlan` explicitly). Per-row pending treatment is already what they do |
| I12 | wake-lock + fullscreen mode | 1 (`CookingMode`) | no | **OOS** |

---

## 7. Out of scope — confirmed, with counts

The plan pre-recorded three exclusions. All three hold; one is over-stated.

| exclusion | real count in 153 | verdict |
|---|---|---|
| **charts beyond `meter`** | **1** — `health/MetricChart` (SVG polyline + area + endpoint dot). `homes/ScoreBadge` and `trips/settlement`'s ring are **not** charts; they are A5 `meter{variant:'ring'}` | **CONFIRMED.** 1/153 = the plan's own "one in 140 is out of scope, not an addition" rule. Leading v2 promotion: a `sparkline` element. Reshape available today: `meter` + a delta `text` |
| **drag-and-drop** | **2**, one app — `kitchen/MealCell` + `WeekGrid` (native HTML5 DnD) | **CONFIRMED.** Also unimplementable on the native target without a gesture layer |
| **free-form canvases** | **0** — no `<canvas>` anywhere in the catalog | **CONFIRMED, vacuously.** Worth stating anyway as a boundary for the `spec-builder` charter, but it costs nothing and is not evidence of a gap |
| *(added)* fullscreen device-mode UI (wake-lock, screen-orientation) | 1 — `kitchen/CookingMode` | **OOS**, `system-appbuilder`'s |
| *(added)* raster-map pin/radius overlay | 1 — `homes/StaticMap` | **OOS** for the overlay; the base tile is `image` with an endpoint-computed URL |

**Home for all of the above: `system-appbuilder`**, which stays frozen and unchanged and remains the
escape hatch for genuinely bespoke UI (plan, Workstream C).

Total out-of-scope: **5 of 153 components = 3.3%**. Two of the five (`MetricChart`, `CookingMode`)
have acceptable reshapes; three (DnD, wake-lock, map overlay) do not and should be routed to the
appbuilder by the `spec-builder`'s "say what you cannot express" charter.

---

## 8. Verdict

**Yes — the catalog is sufficient, and it should be *smaller* than proposed, not larger.** Of 153
hand-built components, **47 (31%) vanish before mapping** into renderer defaults and modifiers the
plan already specifies; **101 (66%) are expressible** in the v1 catalog as written or with the
twelve amendments in §5.1 — of which **eleven are props or modifiers on elements that already exist**
and exactly **one is a new element** (`field`); and **5 (3.3%) are out of scope**, matching the plan's
pre-recorded exclusions almost exactly. Cutting the five tokens the survey does not earn (`chip`,
`avatar`, `code`, `quote`, `map`) leaves a **22-element catalog** that expresses strictly more of the
corpus than the proposed 26 — the right direction for a DeepSeek-class model. 19 of the 26 proposed
elements already have a renderable, mostly native-forked implementation in
`render-descriptor.tsx` or `libs/ui/src/elements/`, so the Wave-1 UI-RENDERER cost concentrates in
one place: `button`'s action/dispatch seam, which does not exist anywhere today because the
descriptor renderer deliberately renders controls inert.

**Residual risk, named: the interactivity surface, not the visual one.** The visual audit was never
close to failing — the failure mode this audit actually found is `I1`, inline per-row mutation with
an argument, demanded by 12 components in 5 of 5 apps and **inexpressible** in the v1 vocabulary as
written, because `button {mutate}` carries no argument. A visuals-only audit would have pinned a
schema that renders every catalog app beautifully and lets a user change nothing about a row. `A2`
(`field`) plus `I3` (`sort`/faceted counts), `I4` (`poll`), and `I5` (`selectable` + bulk) are the
schema's real completeness question, and all four must land in the pinned schema — a promotion after
the fact is far more expensive here than for a visual, because each one changes the *section*
contract, not an element leaf. The secondary risk is `A1`: `tone: 'auto'` cannot know that
`self_care` is good news and `emergency` is not, so the declared `toneMap` is load-bearing for
roughly a third of the corpus; if it is dropped for simplicity, every status pill in every app
regresses to one color and the visual gate will find it late.
