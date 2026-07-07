import React from 'react';
import type { TasteNote, TasteSignal } from '@app/types';
import { useApi, Chat } from '@app/runtime';
import { SearchTabs } from '../../../components/SearchTabs';
import { TasteNoteCard } from '../../../components/TasteNoteCard';
import { Spinner } from '../../../components/Spinner';
import { formatDateTime } from '../../../components/format';

const DIMENSIONS = ['style', 'light', 'layout', 'location', 'building', 'dealbreaker', 'other'];

type SignalWithListing = TasteSignal & { listingTitle?: string };

interface TasteProfile {
  notes: TasteNote[];
  signals: SignalWithListing[];
}

export default function SearchTaste({ params }: { params: { searchId: string } }) {
  const { searchId } = params;
  const { data, isLoading, error } = useApi<TasteProfile>('tasteProfile', { id: searchId });

  const notes = data?.notes ?? [];
  const signals = data?.signals ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <SearchTabs searchId={searchId} active="taste" />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Your taste, learned</h1>
        <p className="text-sm text-muted-foreground">
          Built entirely from what you save and dismiss — plain-language, cited, and fully
          inspectable. Nothing here is a black box.
        </p>
      </div>

      {isLoading ? <Spinner label="Learning your taste…" /> : null}
      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load taste profile.
        </div>
      ) : null}

      {!isLoading && !error && notes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No taste notes yet — save or dismiss a few listings and the model will start writing
          itself.
        </div>
      ) : null}

      {DIMENSIONS.map((dim) => {
        const dimNotes = notes.filter((n) => n.dimension === dim);
        if (dimNotes.length === 0) return null;
        return (
          <section key={dim} className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {dim}
            </h2>
            <div className="space-y-2">
              {dimNotes.map((n) => (
                <TasteNoteCard key={n.id} note={n} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Recent signals
        </h2>
        {signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No signals yet.</p>
        ) : (
          <div className="space-y-1.5">
            {signals.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span
                    className={
                      s.action === 'save'
                        ? 'font-medium text-primary'
                        : s.action === 'dismiss'
                          ? 'font-medium text-muted-foreground'
                          : 'font-medium text-foreground'
                    }
                  >
                    {s.action}
                  </span>{' '}
                  <span className="text-foreground">{s.listingTitle ?? 'a listing'}</span>
                  {s.reason ? <span className="text-muted-foreground"> — “{s.reason}”</span> : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(s.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Correct your taste profile
        </h2>
        <p className="text-sm text-muted-foreground">
          Tell the ranker directly if a note is wrong — it&apos;ll fold the correction in.
        </p>
        <Chat agent="scout/ranker" />
      </section>
    </main>
  );
}
