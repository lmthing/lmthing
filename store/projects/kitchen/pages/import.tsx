import React, { useState } from 'react';
import { useApiMutation, Chat, Link } from '@app/runtime';
import { ImportForm } from '../components/ImportForm';

interface ImportResult {
  recipeId: string;
  status: string;
}

export default function Import() {
  const importRecipe = useApiMutation<ImportResult>('importRecipe');
  const [result, setResult] = useState<ImportResult | null>(null);

  const onImport = async (url: string) => {
    setResult(null);
    try {
      const res = await importRecipe.mutate({ url });
      setResult(res ?? null);
    } catch {
      // surfaced via importRecipe.error below
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">Import a recipe</h1>
        <p className="text-sm text-muted-foreground">
          Paste a link to a recipe page — we&apos;ll fetch it, parse the ingredients and
          instructions, and drop it into your recipe box.
        </p>
      </div>

      <ImportForm onImport={onImport} pending={importRecipe.isPending} />

      {importRecipe.error ? (
        <p className="text-sm text-destructive">
          {(importRecipe.error as { message?: string })?.message ?? 'Failed to import recipe.'}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-foreground">
            Import started for recipe <span className="font-medium">{result.recipeId}</span>
            {' — '}
            {result.status}. The importer is working in the background.
          </p>
          <Link href="/recipes" className="text-sm text-primary hover:underline">
            View recipes →
          </Link>
        </div>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">
          Or just paste a link in chat
        </h2>
        <Chat agent="sourcing/importer" />
      </section>
    </main>
  );
}
