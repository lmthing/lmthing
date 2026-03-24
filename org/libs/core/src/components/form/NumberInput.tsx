import { useState } from 'react';

export interface NumberInputProps {
  name: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}

export function NumberInput({ name, label, min, max, step, defaultValue = 0 }: NumberInputProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={name}>{label}</label>
      <input
        type="number"
        id={name}
        name={name}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setValue(Number(e.target.value))}
      />
    </div>
  );
}
