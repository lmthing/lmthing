import React, { useState } from 'react';
import { useApiMutation, navigate } from '@app/runtime';

const MODES = ['rent', 'buy'];
const CURRENCIES = ['EUR', 'USD', 'GBP'];
const COMMUTE_MODES = ['transit', 'walk', 'bike', 'drive'];

interface CommuteRow {
  label: string;
  address: string;
  mode: string;
  maxMinutes: string;
}

function emptyRow(): CommuteRow {
  return { label: '', address: '', mode: 'transit', maxMinutes: '30' };
}

export default function NewSearch() {
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [mode, setMode] = useState('rent');
  const [area, setArea] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [minRooms, setMinRooms] = useState('');
  const [minAreaSqm, setMinAreaSqm] = useState('');
  const [mustHaves, setMustHaves] = useState('');
  const [commuteTargets, setCommuteTargets] = useState<CommuteRow[]>([emptyRow()]);

  const createSearch = useApiMutation<{ id: string }>('createSearch', {
    invalidates: ['searchList'],
  });

  const updateRow = (i: number, patch: Partial<CommuteRow>) => {
    setCommuteTargets((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => setCommuteTargets((rows) => [...rows, emptyRow()]);
  const removeRow = (i: number) => setCommuteTargets((rows) => rows.filter((_, j) => j !== i));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !brief.trim() || !budgetMax) return;
    try {
      const res = await createSearch.mutate({
        title: title.trim(),
        brief: brief.trim(),
        mode,
        area: area.trim() || undefined,
        budgetMax: Number(budgetMax),
        budgetMin: budgetMin ? Number(budgetMin) : undefined,
        currency,
        minRooms: minRooms ? Number(minRooms) : undefined,
        minAreaSqm: minAreaSqm ? Number(minAreaSqm) : undefined,
        mustHaves: mustHaves
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        commuteTargets: commuteTargets
          .filter((r) => r.label.trim() && r.address.trim())
          .map((r) => ({
            label: r.label.trim(),
            address: r.address.trim(),
            mode: r.mode,
            maxMinutes: Number(r.maxMinutes) || 30,
          })),
      });
      navigate(`/searches/${res.id}/inbox`);
    } catch {
      // surfaced via createSearch.error below
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Start a new search</h1>
        <p className="text-sm text-muted-foreground">
          Describe what you&apos;re after — the more specific, the sharper the ranking.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            What are you looking for
          </h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Lisbon 2-bed rental"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="brief">
              Describe it in your own words
            </label>
            <textarea
              id="brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              required
              rows={4}
              placeholder="Bright 2-bedroom, quiet street, near a park, walk to Anjos metro…"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              This drives everything — the taste model starts here and sharpens with every save
              and dismiss.
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Budget & basics
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="mode">
                Mode
              </label>
              <select
                id="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="area">
                Area
              </label>
              <input
                id="area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Arroios, Alameda, Anjos"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="budgetMax">
                {mode === 'rent' ? 'Max monthly budget' : 'Max price'}
              </label>
              <input
                id="budgetMax"
                type="number"
                min="0"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                required
                placeholder="1800"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="currency">
                Currency
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="budgetMin">
              Minimum budget (optional)
            </label>
            <input
              id="budgetMin"
              type="number"
              min="0"
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Filters out obvious mistakes and too-good-to-be-true listings.
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Hard requirements
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="minRooms">
                Minimum rooms
              </label>
              <input
                id="minRooms"
                type="number"
                min="0"
                value={minRooms}
                onChange={(e) => setMinRooms(e.target.value)}
                placeholder="0 = no constraint"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="minAreaSqm">
                Minimum size (m²)
              </label>
              <input
                id="minAreaSqm"
                type="number"
                min="0"
                value={minAreaSqm}
                onChange={(e) => setMinAreaSqm(e.target.value)}
                placeholder="0 = no constraint"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="mustHaves">
              Must-haves
            </label>
            <input
              id="mustHaves"
              value={mustHaves}
              onChange={(e) => setMustHaves(e.target.value)}
              placeholder="elevator, pets allowed, balcony"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. A listing failing one of these is capped, never top-ranked.
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Commute targets
              </h2>
              <p className="text-xs text-muted-foreground">
                Where do you need to get to, and how fast?
              </p>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-primary hover:bg-muted"
            >
              + Add target
            </button>
          </div>

          <div className="space-y-3">
            {commuteTargets.map((row, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-background p-3"
              >
                <div className="min-w-[120px] flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Label</label>
                  <input
                    value={row.label}
                    onChange={(e) => updateRow(i, { label: e.target.value })}
                    placeholder="Office"
                    className="w-full rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
                  />
                </div>
                <div className="min-w-[160px] flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Address</label>
                  <input
                    value={row.address}
                    onChange={(e) => updateRow(i, { address: e.target.value })}
                    placeholder="Praça do Comércio, Lisbon"
                    className="w-full rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Mode</label>
                  <select
                    value={row.mode}
                    onChange={(e) => updateRow(i, { mode: e.target.value })}
                    className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
                  >
                    {COMMUTE_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-20 space-y-1">
                  <label className="text-xs text-muted-foreground">Max min</label>
                  <input
                    type="number"
                    min="0"
                    value={row.maxMinutes}
                    onChange={(e) => updateRow(i, { maxMinutes: e.target.value })}
                    className="w-full rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </div>
            ))}
            {commuteTargets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No commute targets — add one above, or skip this.
              </p>
            ) : null}
          </div>
        </section>

        {createSearch.error ? (
          <p className="text-sm text-destructive">
            {(createSearch.error as { message?: string })?.message ?? 'Failed to create search.'}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={createSearch.isPending || !title.trim() || !brief.trim() || !budgetMax}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {createSearch.isPending ? 'Starting the hunt…' : 'Start the hunt'}
        </button>
      </form>
    </main>
  );
}
