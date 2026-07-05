import React, { useState, useEffect } from 'react';
import type { Setting } from '@app/types';

const DIETS = ['none', 'vegetarian', 'vegan', 'pescatarian', 'keto'];

export interface SettingsPatch {
  householdSize?: number;
  diet?: string;
  allergies?: string[];
  dislikes?: string[];
  cuisines?: string[];
  maxPrepMinutes?: number;
  calorieTarget?: number;
  proteinTarget?: number;
}

function toCsv(list: string[] | undefined): string {
  return (list ?? []).join(', ');
}

function fromCsv(text: string): string[] {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function PreferencesForm({
  value,
  onSave,
  saving,
}: {
  value: Setting;
  onSave: (patch: SettingsPatch) => void;
  saving: boolean;
}) {
  const [householdSize, setHouseholdSize] = useState(String(value.householdSize ?? 2));
  const [diet, setDiet] = useState(value.diet ?? 'none');
  const [allergies, setAllergies] = useState(toCsv(value.allergies));
  const [dislikes, setDislikes] = useState(toCsv(value.dislikes));
  const [cuisines, setCuisines] = useState(toCsv(value.cuisines));
  const [maxPrepMinutes, setMaxPrepMinutes] = useState(String(value.maxPrepMinutes ?? 45));
  const [calorieTarget, setCalorieTarget] = useState(String(value.calorieTarget ?? 2000));
  const [proteinTarget, setProteinTarget] = useState(String(value.proteinTarget ?? 80));

  useEffect(() => {
    setHouseholdSize(String(value.householdSize ?? 2));
    setDiet(value.diet ?? 'none');
    setAllergies(toCsv(value.allergies));
    setDislikes(toCsv(value.dislikes));
    setCuisines(toCsv(value.cuisines));
    setMaxPrepMinutes(String(value.maxPrepMinutes ?? 45));
    setCalorieTarget(String(value.calorieTarget ?? 2000));
    setProteinTarget(String(value.proteinTarget ?? 80));
  }, [value]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      householdSize: Number(householdSize) || undefined,
      diet,
      allergies: fromCsv(allergies),
      dislikes: fromCsv(dislikes),
      cuisines: fromCsv(cuisines),
      maxPrepMinutes: Number(maxPrepMinutes) || undefined,
      calorieTarget: Number(calorieTarget) || undefined,
      proteinTarget: Number(proteinTarget) || undefined,
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Household size</span>
          <input
            type="number"
            min={1}
            value={householdSize}
            onChange={(e) => setHouseholdSize(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Diet</span>
          <select
            value={diet}
            onChange={(e) => setDiet(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground"
          >
            {DIETS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Allergies (comma separated)</span>
        <input
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          placeholder="peanuts, shellfish"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Dislikes (comma separated)</span>
        <input
          value={dislikes}
          onChange={(e) => setDislikes(e.target.value)}
          placeholder="cilantro, olives"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Favorite cuisines (comma separated)</span>
        <input
          value={cuisines}
          onChange={(e) => setCuisines(e.target.value)}
          placeholder="italian, thai"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Max prep (min)</span>
          <input
            type="number"
            min={0}
            value={maxPrepMinutes}
            onChange={(e) => setMaxPrepMinutes(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Calorie target</span>
          <input
            type="number"
            min={0}
            value={calorieTarget}
            onChange={(e) => setCalorieTarget(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Protein target (g)</span>
          <input
            type="number"
            min={0}
            value={proteinTarget}
            onChange={(e) => setProteinTarget(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save preferences'}
      </button>
    </form>
  );
}

export default PreferencesForm;
