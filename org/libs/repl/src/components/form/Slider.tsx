import { useState } from 'react';

export interface SliderProps {
  name: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
}

export function Slider({ name, label, min, max, step = 1, defaultValue }: SliderProps) {
  const [value, setValue] = useState(defaultValue ?? min);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={name}>{label} ({value})</label>
      <input
        type="range"
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
