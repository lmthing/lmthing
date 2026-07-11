// Subscribes to the synthetic db event fired when a recipe is added via the
// addRecipe/importRecipe api handlers (main-process writes → dispatch). Declarative
// trigger form is used: the nutritionist self-queries recipes lacking nutrition_facts for
// their ingredients and estimates them. nutrition_facts has no hook of its own, so this
// chain is terminal (bounded).
export default {
  type: 'event',
  on: { event: 'project/db.recipes.insert' },
  trigger: 'nutrition/nutritionist#analyze-recipe',
  budget: { maxEpisodes: 8, maxWallClockMs: 600000 },
};
