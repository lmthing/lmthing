import { type ReactNode } from 'react';

export interface FormProps {
  children: ReactNode;
  onSubmit?: (form: HTMLFormElement) => void;
}

export function Form({ children, onSubmit }: FormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit?.(e.currentTarget);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {children}
      <button type="submit">Submit</button>
    </form>
  );
}
