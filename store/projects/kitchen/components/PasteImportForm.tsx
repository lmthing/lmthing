import React, { useState } from 'react';

/**
 * Paste-anything recipe import: a free-text box for a WhatsApp message, a photo caption, or OCR'd
 * text. The importer agent extracts a structured recipe from it. Complements the URL import.
 */
export function PasteImportForm({
  onImport,
  pending,
}: {
  onImport: (text: string) => void;
  pending: boolean;
}) {
  const [text, setText] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 8) return;
    onImport(text.trim());
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <label htmlFor="paste-recipe" className="text-sm font-medium text-foreground">
        Paste a recipe
      </label>
      <textarea
        id="paste-recipe"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={
          'Paste a recipe from anywhere — a message, a caption, a screenshot transcription…\n\ne.g. "Garlic butter shrimp: 400g shrimp, 3 cloves garlic, 50g butter, parsley. Sauté garlic in butter, add shrimp 3 min, finish with parsley."'
        }
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <button
        type="submit"
        disabled={pending || text.trim().length < 8}
        className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {pending ? 'Extracting…' : 'Extract recipe'}
      </button>
    </form>
  );
}

export default PasteImportForm;
