import React from 'react';

/**
 * Renders one traveler and their preferences grouped by category — shown in chat after the host's
 * `profile` action runs, or alongside the party roster.
 */
export function TravelerProfile({
  name,
  role,
  groups,
}: {
  name: string;
  role?: string;
  groups: { category: string; values: string[] }[];
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{name}</h3>
        {role ? <span className="text-xs capitalize text-muted-foreground">{role}</span> : null}
      </div>

      {groups.length > 0 ? (
        <dl className="mt-2 flex flex-col gap-1">
          {groups.map((g, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <dt className="w-20 flex-none capitalize text-muted-foreground">{g.category}</dt>
              <dd className="text-foreground">{g.values.join(', ')}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No preferences recorded yet.</p>
      )}
    </div>
  );
}

export default TravelerProfile;
