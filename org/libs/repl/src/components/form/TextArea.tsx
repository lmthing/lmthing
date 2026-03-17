import { useState } from 'react';

export interface TextAreaProps {
  name: string;
  label: string;
  placeholder?: string;
  rows?: number;
}

export function TextArea({ name, label, placeholder, rows = 4 }: TextAreaProps) {
  const [value, setValue] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={name}>{label}</label>
      <textarea
        id={name}
        name={name}
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
