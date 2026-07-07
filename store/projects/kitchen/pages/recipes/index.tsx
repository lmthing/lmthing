import React, { useState } from 'react';
import type { Recipe } from '@app/types';
import { useApi, useApiMutation, Link } from '@app/runtime';
import { RecipeCard } from '../../components/RecipeCard';
import { RecipeCardsSkeleton } from '../../components/Skeleton';
import { ImportForm } from '../../components/ImportForm';
import { PasteImportForm } from '../../components/PasteImportForm';
import { Plus, Download, ClipboardList } from '../../components/icons';

type Mode = 'none' | 'add' | 'url' | 'paste';

export default function Recipes() {
  const [tag, setTag] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<Mode>('none');

  const { data: recipes, isLoading, error, refetch } = useApi<Recipe[]>('listRecipes', { tag });

  const addRecipe = useApiMutation<Recipe>('addRecipe', { invalidates: ['listRecipes'] });
  const importRecipe = useApiMutation<{ recipeId: string }>('importRecipe', { invalidates: ['listRecipes'] });
  const importRecipeText = useApiMutation<{ recipeId: string }>('importRecipeText', {
    invalidates: ['listRecipes'],
  });

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [importedNote, setImportedNote] = useState<string | null>(null);

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
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setTitle('');
      setInstructions('');
      setTagsInput('');
      setMode('none');
    } catch {
      /* surfaced via addRecipe.error */
    }
  };

  const btn = (m: Mode, label: string, Icon: (p: { className?: string }) => React.ReactElement) => (
    <button
      type="button"
      onClick={() => setMode((v) => (v === m ? 'none' : m))}
      className={
        mode === m
          ? 'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground'
          : 'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted'
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Recipes</h1>
        <div className="flex flex-wrap gap-2">
          {btn('add', 'Add recipe', Plus)}
          {btn('url', 'Import from URL', Download)}
          {btn('paste', 'Paste', ClipboardList)}
        </div>
      </div>

      {mode === 'add' ? (
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

      {mode === 'url' ? (
        <div className="space-y-2">
          <ImportForm
            pending={importRecipe.isPending}
            onImport={async (url) => {
              setImportedNote(null);
              try {
                await importRecipe.mutate({ url });
                setImportedNote('Import started — the importer is working in the background.');
                setTimeout(() => refetch(), 2500);
              } catch {
                /* surfaced below */
              }
            }}
          />
          {importRecipe.error ? (
            <p className="text-sm text-destructive">
              {(importRecipe.error as { message?: string })?.message ?? 'Failed to import.'}
            </p>
          ) : null}
          {importedNote ? <p className="text-sm text-muted-foreground">{importedNote}</p> : null}
        </div>
      ) : null}

      {mode === 'paste' ? (
        <div className="space-y-2">
          <PasteImportForm
            pending={importRecipeText.isPending}
            onImport={async (text) => {
              setImportedNote(null);
              try {
                await importRecipeText.mutate({ text });
                setImportedNote('Extracting your recipe — it will appear here shortly.');
                setTimeout(() => refetch(), 2500);
              } catch {
                /* surfaced below */
              }
            }}
          />
          {importRecipeText.error ? (
            <p className="text-sm text-destructive">
              {(importRecipeText.error as { message?: string })?.message ?? 'Failed to extract.'}
            </p>
          ) : null}
          {importedNote ? <p className="text-sm text-muted-foreground">{importedNote}</p> : null}
        </div>
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

      {isLoading ? <RecipeCardsSkeleton /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load recipes.
        </div>
      ) : null}

      {!isLoading && !error && (recipes ?? []).length === 0 ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">No recipes yet. Add, import, or paste one to get started.</p>
          <Link href="/" className="text-sm text-primary hover:underline">
            Or seed starter recipes from the Cook tab →
          </Link>
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
