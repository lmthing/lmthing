import { useState } from 'react';

export interface MultiSelectProps {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string[];
}

export function MultiSelect({ name, label, options, defaultValue = [] }: MultiSelectProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultValue));

  const toggle = (option: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) {
        next.delete(option);
      } else {
        next.add(option);
      }
      return next;
    });
  };

  return (
    <fieldset style={{ display: 'flex', flexDirection: 'column', gap: '4px', border: 'none', padding: 0, margin: 0 }}>
      <legend>{label}</legend>
      {options.map((option) => (
        <div key={option} style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
          <input
            type="checkbox"
            id={`${name}-${option}`}
            name={name}
            value={option}
            checked={selected.has(option)}
            onChange={() => toggle(option)}
          />
          <label htmlFor={`${name}-${option}`}>{option}</label>
        </div>
      ))}
    </fieldset>
  );
}
