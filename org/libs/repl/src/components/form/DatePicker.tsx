import { useState } from 'react';

export interface DatePickerProps {
  name: string;
  label: string;
  defaultValue?: string;
}

export function DatePicker({ name, label, defaultValue = '' }: DatePickerProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={name}>{label}</label>
      <input
        type="date"
        id={name}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
