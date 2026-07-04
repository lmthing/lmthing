import React, { useState } from 'react';
import { useApiMutation } from '@app/runtime';

export function ImportForm({ onImported }: { onImported?: () => void }) {
  const importMetrics = useApiMutation<{ imported: number }>('importMetrics', {
    invalidates: ['listMetrics'],
  });

  const [format, setFormat] = useState('csv');
  const [csv, setCsv] = useState('');
  const [imported, setImported] = useState<number | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csv.trim()) return;
    try {
      const result = await importMetrics.mutate({ format, csv });
      setImported(result?.imported ?? 0);
      setCsv('');
      onImported?.();
    } catch {
      // surfaced via importMetrics.error below
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value)}
        className="w-44 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
      >
        <option value="csv">CSV</option>
        <option value="apple">Apple Health</option>
        <option value="google">Google Fit</option>
      </select>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder="kind,value,unit,recordedAt"
        rows={5}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground font-mono"
      />
      <button
        type="submit"
        disabled={importMetrics.isPending || !csv.trim()}
        className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {importMetrics.isPending ? 'Importing…' : 'Import metrics'}
      </button>
      {imported != null ? (
        <p className="text-sm text-success">
          Imported {imported} metric{imported === 1 ? '' : 's'}.
        </p>
      ) : null}
      {importMetrics.error ? (
        <p className="text-sm text-destructive">
          {(importMetrics.error as { message?: string })?.message ?? 'Failed to import metrics.'}
        </p>
      ) : null}
    </form>
  );
}

export default ImportForm;
