import React, { useState } from 'react';
import { useApiMutation, Chat, Link } from '@app/runtime';
import { ImportForm } from '../components/ImportForm';
import { PasteImportForm } from '../components/PasteImportForm';

interface ImportResult {
  recipeId: string;
  status: string;
}

export default function Import() {
  const importRecipe = useApiMutation<ImportResult>('importRecipe');
  const importRecipeText = useApiMutation<ImportResult>('importRecipeText');
  const [result, setResult] = useState<ImportResult | null>(null);

  const onImportUrl = async (url: string) => {
    setResult(null);
    try {
      setResult((await importRecipe.mutate({ url })) ?? null);
    } catch {
      /* surfaced below */
    }
  };

  const onImportText = async (text: string) => {
    setResult(null);
    try {
      setResult((await importRecipeText.mutate({ text })) ?? null);
    } catch {
      /* surfaced below */
    }
  };

  const err = importRecipe.error ?? importRecipeText.error;

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">Import a recipe</h1>
        <p className="text-sm text-muted-foreground">
          Paste a link to a recipe page, or paste the recipe text from anywhere — we&apos;ll parse the
          ingredients and instructions and drop it into your recipe box.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">From a URL</h2>
        <ImportForm onImport={onImportUrl} pending={importRecipe.isPending} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Paste anything</h2>
        <PasteImportForm onImport={onImportText} pending={importRecipeText.isPending} />
      </section>

      {err ? (
        <p className="text-sm text-destructive">
          {(err as { message?: string })?.message ?? 'Failed to import recipe.'}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-foreground">
            Import started ({result.status}). The importer is working in the background.
          </p>
          <Link href="/recipes" className="text-sm text-primary hover:underline">
            View recipes →
          </Link>
        </div>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Or just paste a link in chat</h2>
        <Chat agent="sourcing/importer" />
      </section>
    </main>
  );
}
