import React, { useState } from 'react';
import { useApiMutation } from '@app/runtime';

const KINDS = [
  { value: 'booking_pdf', label: 'Booking confirmation' },
  { value: 'ticket_image', label: 'Ticket / e-ticket' },
  { value: 'itinerary', label: 'Itinerary' },
  { value: 'passport_visa', label: 'Passport / visa' },
  { value: 'place_photo', label: 'Place photo' },
  { value: 'other', label: 'Other' },
];

export function DocumentUploadForm({
  tripId,
  onUploaded,
}: {
  tripId: string;
  onUploaded?: () => void;
}) {
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('');
  const [kind, setKind] = useState('other');

  const uploadDocument = useApiMutation<{ id: string }>('uploadDocument', {
    invalidates: ['listDocuments'],
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await uploadDocument.mutate({
        id: tripId,
        content: content.trim(),
        kind,
        filename: filename.trim() || undefined,
      });
      setContent('');
      setFilename('');
      setKind('other');
      onUploaded?.();
    } catch {
      // surfaced via uploadDocument.error below
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="doc-content">
          Paste the document
        </label>
        <textarea
          id="doc-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={5}
          placeholder="Paste a booking confirmation, itinerary, ticket, or visa note…"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="doc-filename">
            Filename (optional)
          </label>
          <input
            id="doc-filename"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="hotel-confirmation.txt"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="doc-kind">
            Kind
          </label>
          <select
            id="doc-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {uploadDocument.error ? (
        <p className="text-sm text-destructive">
          {(uploadDocument.error as { message?: string })?.message ?? 'Failed to upload document.'}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={uploadDocument.isPending || !content.trim()}
        className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {uploadDocument.isPending ? 'Uploading…' : 'Upload document'}
      </button>
    </form>
  );
}
