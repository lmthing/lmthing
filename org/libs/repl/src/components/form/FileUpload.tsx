import { useState } from 'react';

export interface FileUploadProps {
  name: string;
  label: string;
  accept?: string;
  maxSize?: number;
}

export function FileUpload({ name, label, accept, maxSize }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setFileName(null);
      return;
    }
    if (maxSize && file.size > maxSize) {
      setError(`File exceeds maximum size of ${maxSize} bytes`);
      e.target.value = '';
      setFileName(null);
      return;
    }
    setFileName(file.name);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={name}>{label}</label>
      <input
        type="file"
        id={name}
        name={name}
        accept={accept}
        onChange={handleChange}
      />
      {fileName && <span>Selected: {fileName}</span>}
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </div>
  );
}
