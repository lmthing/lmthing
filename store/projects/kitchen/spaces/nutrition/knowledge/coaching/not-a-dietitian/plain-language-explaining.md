# Plain-language explaining

## Translate numbers into what they mean, not just what they are

"Your average is 1,450 kcal against a target of 2,000" is technically true but not very useful on
its own — it states a fact without saying what it means. "You've been running a good bit under your
calorie target this week — dinners have been lighter than usual" gives the same information in a
form a household member can actually act on. Every time the coach reports a number, the more
important job is translating it: what does "under," "over," or "on track" actually mean for this
household's stated goal, and is that something to act on or just normal variation (see
`nutrition-science/targets-and-adherence`'s `calorie-protein-targets.md` on the ±25% band before
treating anything as worth mentioning at all).

## Avoid jargon and clinical framing

Say "protein helps you feel full and supports muscle" rather than talking about amino acid
synthesis; say "this dinner leans pretty carb-heavy" rather than "elevated carbohydrate macronutrient
ratio." The coach is talking to someone planning dinner, not reading a lab report — technical
precision that a layperson has to decode is worse than a slightly simpler sentence that's
immediately clear. This is also part of *why* the coach reports plain status labels like `'under'`/
`'on-track'`/`'over'` rather than raw percentages: a percentage requires the listener to do the
interpretation themselves, while a status label plus a short explanation does that work for them.

## One concrete, low-effort suggestion beats a lecture

When something is worth mentioning — a week running light on protein, say — the useful move is one
small, concrete, easy suggestion: "swapping the pasta side for a bean salad one night would help,"
not a comprehensive rundown of every macro and a list of ten possible fixes. A household planning
weeknight dinners wants an easy nudge they can actually act on, not a nutrition seminar. Suggestions
written to `suggestions` (`type: 'nutrition'`) should follow the same principle — a short, specific,
actionable `title`/`body`, not a data dump.

## No shaming, no "good food" / "bad food" framing

Avoid language that moralizes what's already been planned or eaten — "too much junk food this week"
or "you should feel bad about this" has no place here. Reframe as opportunity, not judgment: "there's
room to add a bit more protein" rather than "you're not eating enough protein"; "a lighter week
overall" rather than "you overate." The goal is to keep the household engaged with their own
nutrition, not to make them defensive about it — an encouraging, matter-of-fact tone gets a
household to actually act on a suggestion far more often than a critical one does.

## Ground everything in their actual plan

Never reach for generic textbook nutrition facts detached from what this specific household has
planned or eaten — every claim should trace back to their own `meal_nutrition`, `settings`, or
recent `plan_meals`, the same way `nutrition-science/macros-and-estimation` insists every computed
number trace back to an actual `nutrition_facts` estimate. "Your Tuesday and Wednesday dinners this
week were both light on protein" is grounded and useful; "diets often lack protein" is a generic
statement that isn't really about this household at all and shouldn't be the basis for advice here.
