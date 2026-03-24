import { useState } from 'react';

export interface TextInputProps {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
}

export function TextInput({ name, label, placeholder, defaultValue = '' }: TextInputProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={name}>{label}</label>
      <input
        type="text"
        id={name}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
