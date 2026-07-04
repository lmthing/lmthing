import React, { useState } from 'react';
import { useApiMutation } from '@app/runtime';

export function UploadForm({ onUploaded }: { onUploaded?: () => void }) {
  const uploadDocument = useApiMutation('uploadDocument', {
    invalidates: ['listDocuments'],
  });

  const [kind, setKind] = useState('lab_pdf');
  const [filename, setFilename] = useState('');
  const [content, setContent] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename.trim() || !content.trim()) return;
    try {
      await uploadDocument.mutate({
        kind,
        filename: filename.trim(),
        content,
      });
      setFilename('');
      setContent('');
      onUploaded?.();
    } catch {
      // surfaced via uploadDocument.error below
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex gap-3">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="w-44 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="lab_pdf">Lab PDF</option>
          <option value="wearable_csv">Wearable CSV</option>
          <option value="note_text">Note text</option>
          <option value="med_label">Medication label</option>
          <option value="other">Other</option>
        </select>
        <input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="Filename"
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        />
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste document content…"
        rows={5}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
      />
      <button
        type="submit"
        disabled={uploadDocument.isPending || !filename.trim() || !content.trim()}
        className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {uploadDocument.isPending ? 'Uploading…' : 'Upload document'}
      </button>
      {uploadDocument.error ? (
        <p className="text-sm text-destructive">
          {(uploadDocument.error as { message?: string })?.message ?? 'Failed to upload document.'}
        </p>
      ) : null}
    </form>
  );
}

export default UploadForm;
