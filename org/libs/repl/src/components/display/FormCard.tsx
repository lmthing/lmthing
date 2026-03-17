import type { ReactNode } from 'react';

export interface FormCardProps {
  formId: string;
  children: ReactNode;
  onSubmit?: () => void;
  submitted?: boolean;
}

export function FormCard({ formId, children, onSubmit, submitted }: FormCardProps) {
  return (
    <div
      data-form-id={formId}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        backgroundColor: submitted ? '#f7fafc' : '#fff',
        padding: 20,
        opacity: submitted ? 0.7 : 1,
        pointerEvents: submitted ? 'none' : 'auto',
        transition: 'opacity 0.2s ease',
      }}
    >
      <div style={{ marginBottom: onSubmit ? 16 : 0 }}>{children}</div>
      {onSubmit && !submitted && (
        <button
          onClick={onSubmit}
          style={{
            backgroundColor: '#3182ce',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 20px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Submit
        </button>
      )}
      {submitted && (
        <div style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>Submitted</div>
      )}
    </div>
  );
}
