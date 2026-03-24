import { useState } from 'react';

export interface SelectProps {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string;
}

export function Select({ name, label, options, defaultValue = '' }: SelectProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={name}>{label}</label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="">-- Select --</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
