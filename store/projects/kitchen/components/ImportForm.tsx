import React, { useState } from 'react';

export function ImportForm({
  onImport,
  pending,
}: {
  onImport: (url: string) => void;
  pending: boolean;
}) {
  const [url, setUrl] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onImport(url.trim());
  };

  return (
    <form onSubmit={onSubmit} className="flex gap-3 rounded-lg border border-border bg-card p-4">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/some-recipe"
        type="url"
        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
      />
      <button
        type="submit"
        disabled={pending || !url.trim()}
        className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {pending ? 'Importing…' : 'Import'}
      </button>
    </form>
  );
}

export default ImportForm;
