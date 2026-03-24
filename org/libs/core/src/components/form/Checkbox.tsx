import { useState } from 'react';

export interface CheckboxProps {
  name: string;
  label: string;
  defaultChecked?: boolean;
}

export function Checkbox({ name, label, defaultChecked = false }: CheckboxProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
      <input
        type="checkbox"
        id={name}
        name={name}
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
      />
      <label htmlFor={name}>{label}</label>
    </div>
  );
}
