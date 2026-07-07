import React from 'react';
import type { Recipe } from '@app/types';
import { Link } from '@app/runtime';
import { renderInline } from './MarkdownBody';

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const tags = Array.isArray(recipe.tags) ? recipe.tags : [];

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 hover:bg-muted transition-colors">
      {recipe.imageUrl ? (
        <img
          src={recipe.imageUrl}
          alt=""
          className="h-32 w-full rounded-md border border-border object-cover"
        />
      ) : null}

      <div className="space-y-1.5">
        <Link href={`/recipes/${recipe.id}`} className="font-bold text-foreground hover:text-primary">
          {recipe.title}
        </Link>

        {recipe.description ? (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {renderInline(recipe.description)}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {recipe.servings ?? 2} servings · {recipe.prepMinutes ?? 30} min
        </p>

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
