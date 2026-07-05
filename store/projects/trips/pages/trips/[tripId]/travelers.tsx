import React, { useState } from 'react';
import type { Traveler } from '@app/types';
import { useApi, useApiMutation, Chat } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { TravelerCard } from '../../../components/TravelerCard';
import { Spinner } from '../../../components/Spinner';

const ROLES = ['organizer', 'companion', 'child', 'other'];
const PREF_CATEGORIES = ['diet', 'mobility', 'interest', 'pace', 'budget', 'other'];

export default function TripTravelers({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const [name, setName] = useState('');
  const [role, setRole] = useState('companion');
  const [prefTravelerId, setPrefTravelerId] = useState<string | null>(null);
  const [prefCategory, setPrefCategory] = useState('diet');
  const [prefValue, setPrefValue] = useState('');

  const { data, isLoading, error } = useApi<{ travelers: Traveler[] }>('listTravelers', {
    id: tripId,
  });

  const travelers = data?.travelers ?? [];

  const addTraveler = useApiMutation<Traveler>('addTraveler', {
    invalidates: ['listTravelers'],
  });
  const setPreference = useApiMutation<{ ok: boolean }>('setPreference', {
    invalidates: ['listTravelers', 'getTraveler'],
  });

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addTraveler.mutate({ id: tripId, name: name.trim(), role });
      setName('');
      setRole('companion');
    } catch {
      // surfaced via addTraveler.error below
    }
  };

  const onAddPreference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefTravelerId || !prefValue.trim()) return;
    try {
      await setPreference.mutate({ id: prefTravelerId, category: prefCategory, value: prefValue.trim() });
      setPrefValue('');
    } catch {
      // surfaced via setPreference.error below
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="travelers" />

      <h1 className="text-2xl font-bold text-foreground">Travelers</h1>

      <form
        onSubmit={onAdd}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="traveler-name">
            Add a traveler
          </label>
          <input
            id="traveler-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alice"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="traveler-role">
            Role
          </label>
          <select
            id="traveler-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={addTraveler.isPending || !name.trim()}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load travelers.
        </div>
      ) : null}

      {!isLoading && !error && travelers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No travelers yet. Add one above.
        </div>
      ) : null}

      <div className="space-y-2">
        {travelers.map((traveler) => (
          <TravelerCard key={traveler.id} traveler={traveler} />
        ))}
      </div>

      {travelers.length > 0 ? (
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Add a preference</h2>
          <form
            onSubmit={onAddPreference}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="pref-traveler">
                Traveler
              </label>
              <select
                id="pref-traveler"
                value={prefTravelerId ?? ''}
                onChange={(e) => setPrefTravelerId(e.target.value || null)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                <option value="">Select…</option>
                {travelers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="pref-category">
                Category
              </label>
              <select
                id="pref-category"
                value={prefCategory}
                onChange={(e) => setPrefCategory(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                {PREF_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="pref-value">
                Value
              </label>
              <input
                id="pref-value"
                value={prefValue}
                onChange={(e) => setPrefValue(e.target.value)}
                placeholder="vegetarian"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={setPreference.isPending || !prefTravelerId || !prefValue.trim()}
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Refine the party with the host</h2>
        <Chat agent="companions/host" />
      </section>
    </main>
  );
}
