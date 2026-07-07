import React, { useState } from 'react';
import type { Ingredient } from '@app/types';
import { useApi, useApiMutation, Chat } from '@app/runtime';
import { IngredientRow } from '../components/IngredientRow';
import { Spinner } from '../components/Spinner';

export default function Pantry() {
  const { data: pantry, isLoading, error } = useApi<Ingredient[]>('listPantry', {});
  const { data: lowStock } = useApi<Ingredient[]>('lowStock', {});

  const updatePantry = useApiMutation<Ingredient>('updatePantry', {
    invalidates: ['listPantry', 'lowStock', 'kitchenStats'],
  });
  const addIngredient = useApiMutation<Ingredient>('addIngredient', {
    invalidates: ['listPantry'],
  });

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState('');

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) return;
    try {
      await addIngredient.mutate({
        name: name.trim(),
        unit: unit.trim(),
        quantity: quantity ? Number(quantity) : undefined,
        category: category.trim() || undefined,
      });
      setName('');
      setUnit('');
      setQuantity('');
      setCategory('');
    } catch {
      // surfaced via addIngredient.error below
    }
  };

  const lowStockCount = (lowStock ?? []).length;

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Pantry</h1>
      </div>

      {lowStockCount > 0 ? (
        <div className="rounded-lg border border-destructive bg-card p-3 text-sm text-destructive">
          {lowStockCount} ingredient{lowStockCount === 1 ? '' : 's'} running low.
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Add ingredient</h2>
        <form onSubmit={onAdd} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Unit (g, ml, count…)"
              className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div className="flex gap-3">
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantity (optional)"
              type="number"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (optional)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={addIngredient.isPending || !name.trim() || !unit.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {addIngredient.isPending ? 'Adding…' : 'Add ingredient'}
          </button>
          {addIngredient.error ? (
            <p className="text-sm text-destructive">
              {(addIngredient.error as { message?: string })?.message ?? 'Failed to add ingredient.'}
            </p>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Stock</h2>

        {isLoading ? <Spinner /> : null}
        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load pantry.
          </div>
        ) : null}
        {!isLoading && !error && (pantry ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No ingredients yet. Add one above.
          </div>
        ) : null}

        <div className="space-y-2">
          {(pantry ?? []).map((ing) => (
            <IngredientRow key={ing.id} unit={ing.unit} name={ing.name}>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  defaultValue={ing.quantity}
                  onBlur={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isNaN(next) && next !== ing.quantity) {
                      updatePantry.mutate({ id: ing.id, quantity: next });
                    }
                  }}
                  className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                />
                <span className="w-10 text-xs text-muted-foreground">{ing.unit}</span>
              </div>
            </IngredientRow>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the pantry keeper</h2>
        <Chat agent="chef/pantry-keeper" />
      </section>
    </main>
  );
}
