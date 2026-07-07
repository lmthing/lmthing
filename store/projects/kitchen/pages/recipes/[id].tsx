import React, { useEffect, useState } from 'react';
import type { Recipe, RecipeIngredient, Ingredient } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { IngredientRow } from '../../components/IngredientRow';
import { MarkdownBody, renderInline } from '../../components/MarkdownBody';
import { MacroTriplet } from '../../components/MacroTriplet';
import { CookingMode } from '../../components/CookingMode';
import { Spinner } from '../../components/Spinner';
import { Utensils } from '../../components/icons';

type RecipeDetail = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient | null })[];
};

interface Macro {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
interface RecipeNutrition extends Macro {
  perServing: Macro;
  missing: string[];
}

export default function RecipeDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: recipe, isLoading, error } = useApi<RecipeDetail>('getRecipe', { id });
  const { data: nutrition } = useApi<RecipeNutrition>('getRecipeNutrition', { id });

  const [cookOpen, setCookOpen] = useState(false);

  // Deep link: /recipes/:id?cook=1 (e.g. the Tonight card's "Start cooking") opens cooking mode.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cook') === '1') {
      setCookOpen(true);
    }
  }, []);

  if (isLoading) return <Spinner />;

  if (error || !recipe) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Recipe not found.
        </div>
      </main>
    );
  }

  const tags = Array.isArray(recipe.tags) ? recipe.tags : [];
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/recipes" className="text-sm text-muted-foreground hover:text-primary">
          ← All recipes
        </Link>
        <button
          type="button"
          onClick={() => setCookOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Utensils className="h-4 w-4" /> Start cooking
        </button>
      </div>

      <div className="space-y-3">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt="" className="w-full rounded-lg border border-border object-cover" />
        ) : null}

        <h1 className="text-2xl font-bold text-foreground">{recipe.title}</h1>

        {recipe.description ? (
          <p className="text-base leading-relaxed text-muted-foreground">{renderInline(recipe.description)}</p>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {recipe.servings ?? 2} servings · {recipe.prepMinutes ?? 30} min
          {tags.length > 0 ? ` · ${tags.map((t) => `#${t}`).join(' ')}` : ''}
        </p>
      </div>

      {nutrition ? (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Nutrition (per serving)</h2>
          <MacroTriplet macros={nutrition.perServing} />
          {nutrition.missing.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Missing nutrition data for: {nutrition.missing.join(', ')}
            </p>
          ) : null}
        </section>
      ) : null}

      {ingredients.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Ingredients</h2>
          <ul className="space-y-2">
            {ingredients.map((ri) => (
              <li key={ri.id}>
                <IngredientRow
                  qty={ri.quantity}
                  unit={ri.ingredient?.unit}
                  name={ri.ingredient?.name ?? 'Unknown ingredient'}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Instructions</h2>
        <MarkdownBody markdown={recipe.instructions ?? ''} />
      </section>

      <CookingMode
        title={recipe.title}
        instructions={recipe.instructions ?? ''}
        open={cookOpen}
        onClose={() => setCookOpen(false)}
      />
    </main>
  );
}
