import React from 'react';
import type { Recipe, RecipeIngredient, Ingredient } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { IngredientRow } from '../../components/IngredientRow';
import { MarkdownBody } from '../../components/MarkdownBody';
import { Spinner } from '../../components/Spinner';

type RecipeDetail = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient | null })[];
};

export default function RecipeDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: recipe, isLoading, error } = useApi<RecipeDetail>('getRecipe', { id });

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

        <p className="text-sm text-muted-foreground">
          {recipe.servings ?? 2} servings · {recipe.prepMinutes ?? 30} min
          {tags.length > 0 ? ` · ${tags.map((t) => `#${t}`).join(' ')}` : ''}
        </p>
      </div>

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
