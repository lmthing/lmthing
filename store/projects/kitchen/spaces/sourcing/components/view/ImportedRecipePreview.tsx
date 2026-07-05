import React from 'react';

/**
 * Confirms a recipe import — shown in chat right after the importer agent (or the `import`
 * tasklist) finishes parsing a fetched page and writing the recipe + its ingredient lines.
 * `ingredientCount` is the number of ingredient lines actually linked, straight from the parsed
 * page — never a guess — so a low count here is honest signal that the page's ingredient list may
 * have been thin, not a rendering issue.
 */
export function ImportedRecipePreview({
  title,
  ingredientCount,
  source,
}: {
  title: string;
  ingredientCount: number;
  source: string;
}) {
  const ok = title.trim().length > 0;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-foreground">
          {ok ? title : "Couldn't find a recipe"}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          {ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-2 truncate text-xs text-muted-foreground" title={source}>
        {source}
      </div>
      {!ok ? (
        <div className="mt-2 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          This page didn't contain a recognizable recipe — nothing was imported.
        </div>
      ) : null}
    </div>
  );
}

export default ImportedRecipePreview;
