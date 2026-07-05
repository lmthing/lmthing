---
id: parse
dependsOn: [fetch_page]
role: general
functions: [parseRecipe]
output:
  title: string
  description: string
  instructions: string
  servings: number
  ingredients: array
  ok: boolean
---

Parse whatever `fetch_page` actually retrieved. `parseRecipe` never throws — an unparseable or
empty page comes back with a blank title and no ingredients rather than an error, per
`recipe-import/parsing-web-recipes`'s extraction strategy:

```ts
const parsed = parseRecipe(fetch_page.html);
const ok = !!parsed.title || parsed.ingredients.length > 0;
```

```ts
currentTask.resolve({
  title: parsed.title,
  description: parsed.description ?? '',
  instructions: parsed.instructions,
  servings: parsed.servings ?? 2,
  ingredients: parsed.ingredients,
  ok,
});
```

Guardrail: `ok: false` is a legitimate, common result — it means "this page did not contain a
recognizable recipe." Every task downstream must treat it as a stop signal, not something to push
through with placeholder content.
