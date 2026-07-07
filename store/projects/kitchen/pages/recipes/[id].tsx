import React from 'react';
import type { Recipe, RecipeIngredient, Ingredient } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { IngredientRow } from '../../components/IngredientRow';
import { MarkdownBody, renderInline } from '../../components/MarkdownBody';
import { Spinner } from '../../components/Spinner';

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
      <div>
        <Link href="/recipes" className="text-sm text-muted-foreground hover:text-primary">
          ← All recipes
        </Link>
      </div>

      <div className="space-y-3">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt=""
            className="w-full rounded-lg border border-border object-cover"
          />
        ) : null}

        <h1 className="text-2xl font-bold text-foreground">{recipe.title}</h1>

        {recipe.description ? (
          <p className="text-base leading-relaxed text-muted-foreground">
            {renderInline(recipe.description)}
          </p>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {recipe.servings ?? 2} servings · {recipe.prepMinutes ?? 30} min
          {tags.length > 0 ? ` · ${tags.map((t) => `#${t}`).join(' ')}` : ''}
        </p>
      </div>

      {nutrition ? (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">
            Nutrition (per serving)
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="text-center">
              <span className="block text-lg font-bold text-foreground">
                {Math.round(nutrition.perServing.calories)}
              </span>
              <span className="text-xs text-muted-foreground">kcal</span>
            </div>
            <div className="text-center">
              <span className="block text-lg font-bold text-foreground">
                {Math.round(nutrition.perServing.protein)}g
              </span>
              <span className="text-xs text-muted-foreground">protein</span>
            </div>
            <div className="text-center">
              <span className="block text-lg font-bold text-foreground">
                {Math.round(nutrition.perServing.carbs)}g
              </span>
              <span className="text-xs text-muted-foreground">carbs</span>
            </div>
            <div className="text-center">
              <span className="block text-lg font-bold text-foreground">
                {Math.round(nutrition.perServing.fat)}g
              </span>
              <span className="text-xs text-muted-foreground">fat</span>
            </div>
          </div>
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
    </main>
  );
}
