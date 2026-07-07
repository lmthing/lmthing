import React from 'react';
import type { Metric, Insight, Setting } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { HealthStats, type Stats } from '../components/HealthStats';
import { MetricChart } from '../components/MetricChart';
import { AttentionStrip } from '../components/AttentionStrip';
import { TodayPlan } from '../components/TodayPlan';
import { QuickLogCard } from '../components/QuickLogCard';
import { InsightCard } from '../components/InsightCard';
import { SkeletonList, ErrorNote } from '../components/states';
import { ArrowRightIcon } from '../components/icons';

interface AttentionItem {
  kind: 'lab' | 'followup' | 'dose' | 'appointment' | 'triage';
  severity: 'emergency' | 'urgent' | 'routine';
  title: string;
  detail: string;
  href: string;
  count?: number;
}

const DEFAULT_TRACKED = ['weight', 'resting_hr', 'sleep_hours'];

function MetricSection({ kind }: { kind: string }) {
  const { data } = useApi<Metric[]>('listMetrics', { kind });
  return <MetricChart kind={kind} points={data ?? []} />;
}

function SectionHeading({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-bold uppercase text-muted-foreground">{title}</h2>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          {linkLabel ?? 'See all'} <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats } = useApi<Stats>('healthStats', {});
  const attention = useApi<{ items: AttentionItem[]; total: number }>('getAttention', {});
  const { data: settings } = useApi<Setting>('getSettings', {});
  const { data: insights } = useApi<Insight[]>('listInsights', {});

  const pinned =
    Array.isArray(settings?.pinnedMetrics) && settings!.pinnedMetrics!.length > 0
      ? (settings!.pinnedMetrics as string[])
      : DEFAULT_TRACKED;
  const latestInsight = (insights ?? [])[0];

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <h1 className="text-xl font-bold text-foreground">Today</h1>

      <section className="space-y-3">
        <SectionHeading title="Needs attention" />
        {attention.isLoading ? (
          <SkeletonList rows={1} />
        ) : attention.error ? (
          <ErrorNote message="Couldn't load your attention items." onRetry={attention.refetch} />
        ) : (
          <AttentionStrip items={attention.data?.items ?? []} />
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading title="Today's plan" />
        <TodayPlan />
      </section>

      <QuickLogCard onCommitted={() => attention.refetch()} />

      {stats ? <HealthStats stats={stats} /> : null}

      <section className="space-y-3">
        <SectionHeading title="Trends" href="/insights" linkLabel="Insights" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pinned.map((k) => (
            <MetricSection key={k} kind={k} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Pin the metrics you care about in <Link href="/settings" className="text-primary hover:underline">Settings</Link>.
        </p>
      </section>

      {latestInsight ? (
        <section className="space-y-3">
          <SectionHeading title="Latest insight" href="/insights" />
          <InsightCard insight={latestInsight} />
        </section>
      ) : null}
    </main>
  );
}
