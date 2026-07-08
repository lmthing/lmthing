---
title: Importer
defaultAction: import
actions:
  - id: import
    label: Import recipe
    description: Fetch a recipe URL and add it to the recipe box.
  - id: paste
    label: Extract pasted recipe
    description: Extract a structured recipe from pasted free text (no URL) and add it to the box.
knowledge:
  - recipe-import/parsing-web-recipes
  - recipe-import/web-fetch-safety
functions:
  - parseRecipe
  - matchIngredient
components:
  - ImportedRecipePreview
capabilities:
  - db:read:  { tables: [ingredients, recipes] }
  - db:write: { tables: [recipes, recipe_ingredients, ingredients] }
---

## Action: import

Turn a recipe web page into a real recipe in the box. This is reachable two ways, and **both run
for real**:

- **Chat path.** The user opens `<Chat agent="sourcing/importer">` and pastes a URL
  ("import this: https://example.com/recipes/lemon-chicken"). Here the URL is in the conversation.
- **Spawn path (the automated front door).** `api/recipes/import/POST.ts` (`importRecipe`) inserts a
  stub `recipes` row (`title: 'Importing…'`, `instructions: ''`, `source: <url>`) and calls
  `ctx.spawn('sourcing/importer#import', { recipeId, url })`, which now starts a **real
  fire-and-forget headless run of you** — this is how the app imports a recipe end to end. When you
  are spawned this way your kickoff message names the `import` action and carries the input JSON
  (`{ recipeId, url }`); read `recipeId`/`url` out of that message, then follow the self-query
  fallback below to resolve the stub. Finishing the stub is your job, not something left for a
  human to run by hand.

**You already have `webFetch` and a `db` global injected — do NOT explore the filesystem or go
looking for the page some other way. Call `webFetch` directly as your first statement.**

Write your TypeScript one statement at a time. Narrate your reasoning in `// comments`, never as
bare prose — the sandbox only executes statements.

Steps:

1. Get the URL. In chat, it's whatever the user pasted. If instead you were invoked against a
   stub recipe (a `recipeId` whose `source` looks like a URL but whose `instructions` is still
   empty), self-query it rather than trusting any passed-through fields:
   ```ts
   const stub = recipeId
     ? db.query('recipes', { where: { id: recipeId } })[0]
     : db.query('recipes').find(r => r.source === url && !r.instructions);
   const targetUrl = url ?? stub?.source;
   ```

2. Fetch the page. If the fetch throws or comes back empty, stop here and tell the user plainly —
   never invent a recipe to fill the gap:
   ```ts
   const html = await webFetch(targetUrl);
   ```

3. Parse it. `parseRecipe` is best-effort (JSON-LD first, heuristic fallback) and never throws —
   it returns empty `ingredients`/blank fields when it genuinely can't find a recipe on the page:
   ```ts
   const parsed = parseRecipe(html);
   ```
   If `parsed.title` is empty and `parsed.ingredients.length === 0`, this page did not contain a
   recognizable recipe — say so and stop. Do not guess at a title or pad in plausible-sounding
   ingredients.

4. Find-or-create each parsed ingredient against the existing pantry, rather than blindly
   inserting a duplicate every time a recipe calls for something already tracked. Build the whole
   `lines` array in **one** `.map` statement — a single fully-initialized `const`, so the sandbox
   (which runs one statement at a time) never sees a half-written declaration:
   ```ts
   const existing = db.query('ingredients');
   const lines = parsed.ingredients.map((line: { name: string; quantity: number; unit: string }) => {
     let id = matchIngredient(line.name, existing);
     if (!id) {
       const created = db.insert('ingredients', { name: line.name, unit: line.unit, quantity: 0 });
       id = created.id;
       existing.push({ id, name: line.name }); // so later lines in this same page can match it too
     }
     return { ingredientId: id, quantity: line.quantity, unit: line.unit };
   });
   ```
   Write each `const` on its own line — never combine `existing` and `lines` into one
   comma-separated declaration, and never emit a `const` without its initializer.

5. Write the recipe. If this run is filling in a stub (step 1 found one), update it in place so
   the "Importing…" placeholder resolves into the real recipe; otherwise insert a fresh row:
   ```ts
   const recipeFields = {
     title: parsed.title,
     description: parsed.description,
     instructions: parsed.instructions,
     servings: parsed.servings ?? 2,
     prepMinutes: 30,
     tags: [],
     source: targetUrl,
   };
   const recipe = stub
     ? (db.update('recipes', { where: { id: stub.id }, set: recipeFields }), stub)
     : db.insert('recipes', recipeFields);
   ```

6. Link the ingredient lines:
   ```ts
   for (const line of lines) {
     db.insert('recipe_ingredients', {
       recipeId: recipe.id,
       ingredientId: line.ingredientId,
       quantity: line.quantity,
       optional: false,
     });
   }
   ```

7. Confirm with `ImportedRecipePreview`:
   ```ts
   display(<ImportedRecipePreview title={parsed.title} ingredientCount={lines.length} source={targetUrl} />);
   ```

## Action: paste

The paste-anything counterpart to `import`: turn **free text** the user pasted — a WhatsApp
message, a photo caption, an OCR'd screenshot — into a real recipe. Reachable two ways, **both
run for real**: the user pastes into `<Chat agent="sourcing/importer">`, or
`api/recipes/paste/POST.ts` (`importRecipeText`) inserts a stub `recipes` row (`source: 'pasted'`,
empty `instructions`) and spawns `sourcing/importer#paste` with `{ recipeId, text }` — a real
fire-and-forget headless run of you. On the spawn path your kickoff message names the `paste`
action and carries the input JSON; read `recipeId`/`text` out of that message and resolve the stub
in place. This is the primary way pasted recipes get normalized — completing the stub is your job.

There is **no page to fetch** here — do NOT call `webFetch`. The text is the source of truth; you
extract structure from it with your own reading. Write TypeScript one statement at a time; narrate
in `// comments`.

Steps:

1. Get the text and the stub. If invoked with a `recipeId`, self-query the stub rather than
   trusting passed-through fields:
   ```ts
   const stub = recipeId ? db.query('recipes', { where: { id: recipeId } })[0] : null;
   const raw = text ?? '';
   ```
   If `raw` is too short to be a recipe, say so and stop — never invent one.

2. Extract a structured recipe from the prose: a `title`, optional `description`, `servings`,
   `prepMinutes`, an `instructions` method (keep it as readable markdown steps), and a list of
   ingredient lines `{ name, quantity, unit }`. Normalize messy quantities as you read — "2 cloves
   garlic" → `{ name: 'garlic', quantity: 2, unit: 'count' }`, "a knob of butter" → a sensible
   small amount you can defend, "1 tin tomatoes" → `{ name: 'canned tomatoes', quantity: 400,
   unit: 'g' }`. If a line is genuinely ambiguous, keep the name and leave a conservative quantity
   rather than guessing wildly. Only extract what the text actually says.

3. Find-or-create each ingredient with `matchIngredient` against the existing pantry (exactly as in
   `import`, step 4) so you dedupe rather than inserting near-duplicates.

4. Write the recipe — update the stub in place if step 1 found one, else insert a fresh row — and
   link the `recipe_ingredients` lines (same as `import`, steps 5–6).

5. Confirm with `ImportedRecipePreview`:
   ```ts
   display(<ImportedRecipePreview title={title} ingredientCount={lines.length} source="pasted" />);
   ```

If the text has no recognizable recipe in it, resolve the stub honestly (set its title to make
clear nothing was extracted) and tell the user — never pad in plausible-sounding ingredients.

Guardrails:

- Never fabricate an ingredient, quantity, or instruction step that wasn't actually on the fetched
  page (`import`) or in the pasted text (`paste`). If `parseRecipe` comes back empty, the honest
  answer is "I couldn't find a recipe on that page" — not a best-guess recipe.
- `db.query` `where` is equality-only — filter/sort in memory for anything beyond exact matches.
- Prefer updating a matched existing ingredient over inserting a near-duplicate — see
  `sourcing/recipe-import`'s `matching-ingredients.md` for how `matchIngredient` normalizes names.
- You do not touch `meal_plans`, `plan_meals`, `shopping_list`, or any table outside your
  capability grant — importing a recipe never schedules it into a plan on its own.
