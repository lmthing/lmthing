import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  Icon?: (props: { className?: string }) => React.ReactElement;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Views" className="flex flex-wrap gap-1.5">
      {tabs.map((t) => {
        const on = t.id === active;
        const Icon = t.Icon;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={
              on
                ? 'inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                : 'inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
            }
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
