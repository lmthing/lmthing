import React, { useState } from 'react';
import type { Recipe } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { RecipeCard } from '../../components/RecipeCard';
import { Spinner } from '../../components/Spinner';

export default function Recipes() {
  const [tag, setTag] = useState<string | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  const { data: recipes, isLoading, error } = useApi<Recipe[]>('listRecipes', { tag });

  const addRecipe = useApiMutation<Recipe>('addRecipe', {
    invalidates: ['listRecipes'],
  });

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const allTags = Array.from(
    new Set((recipes ?? []).flatMap((r) => (Array.isArray(r.tags) ? r.tags : []))),
  ).sort();

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !instructions.trim()) return;
    try {
      await addRecipe.mutate({
        title: title.trim(),
        instructions: instructions.trim(),
        tags: tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setTitle('');
      setInstructions('');
      setTagsInput('');
      setShowForm(false);
    } catch {
      // surfaced via addRecipe.error below
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Recipes</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted"
        >
          {showForm ? 'Cancel' : 'Add recipe'}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={onAdd} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instructions (markdown)"
            rows={5}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags, comma separated (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={addRecipe.isPending || !title.trim() || !instructions.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {addRecipe.isPending ? 'Adding…' : 'Add recipe'}
          </button>
          {addRecipe.error ? (
            <p className="text-sm text-destructive">
              {(addRecipe.error as { message?: string })?.message ?? 'Failed to add recipe.'}
            </p>
          ) : null}
        </form>
      ) : null}

      {allTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTag(undefined)}
            className={
              !tag
                ? 'rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground'
                : 'rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-muted'
            }
          >
            All
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(t)}
              className={
                tag === t
                  ? 'rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground'
                  : 'rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-muted'
              }
            >
              #{t}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load recipes.
        </div>
      ) : null}

      {!isLoading && !error && (recipes ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No recipes yet.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(recipes ?? []).map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>
    </main>
  );
}
