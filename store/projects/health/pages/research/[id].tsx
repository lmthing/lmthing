import React, { useEffect } from 'react';
import type { Research } from '@app/types';
import { useApi, Chat, Link } from '@app/runtime';
import { MarkdownBody } from '../../components/MarkdownBody';
import { ExplainPlainly } from '../../components/ExplainPlainly';
import { AIWorking, ErrorNote, SkeletonList } from '../../components/states';

export default function ResearchDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: research, isLoading, error, refetch } = useApi<Research>('getResearch', { id });

  useEffect(() => {
    if (research?.status !== 'pending') return;
    const interval = setInterval(() => {
      refetch();
    }, 4000);
    return () => clearInterval(interval);
  }, [research?.status, refetch]);

  if (isLoading) return <main className="mx-auto max-w-3xl p-6"><SkeletonList rows={3} /></main>;

  if (error || !research) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <Link href="/labs" className="text-sm text-muted-foreground hover:text-primary">
          ← All labs
        </Link>
        <ErrorNote message="Research report not found." onRetry={refetch} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/labs" className="text-sm text-muted-foreground hover:text-primary">
          ← All labs
        </Link>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{research.topic}</h1>
        <span className="inline-block rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
          {research.status}
        </span>
      </div>

      {research.status === 'pending' ? (
        <AIWorking
          agent="The researcher"
          label="Researching…"
          hint="Reading the literature and citing sources — this page updates automatically."
        />
      ) : (
        <>
          <MarkdownBody markdown={research.body ?? ''} />
          <ExplainPlainly
            agent="clinic/researcher"
            suggestion="Summarise this research in 2–3 plain sentences for me."
          />
        </>
      )}

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the researcher</h2>
        <Chat agent="clinic/researcher" />
      </section>
    </main>
  );
}
