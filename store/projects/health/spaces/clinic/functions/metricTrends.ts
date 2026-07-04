export interface MetricPoint {
  kind: string;
  value: number;
  recordedAt?: string;
}

export interface MetricTrend {
  metricKind: string;
  changePct: number;
  points: number;
}

/**
 * Group a flat list of metrics by `kind` and compute each kind's rolling trend as the percent
 * change from its earliest to its latest value (chronological). Returns one row per kind so the
 * interpreter can write insights / a visit brief with a single call — no manual grouping, sorting,
 * or type gymnastics in the agent. A kind with fewer than 2 points reports `changePct: 0`.
 */
export function metricTrends(metrics: MetricPoint[]): MetricTrend[] {
  const groups: Record<string, MetricPoint[]> = {};
  for (const m of metrics) {
    if (!groups[m.kind]) groups[m.kind] = [];
    groups[m.kind].push(m);
  }
  const out: MetricTrend[] = [];
  for (const kind of Object.keys(groups)) {
    const list = groups[kind]
      .slice()
      .sort((a, b) => String(a.recordedAt ?? '').localeCompare(String(b.recordedAt ?? '')));
    const values = list.map((m) => m.value);
    let changePct = 0;
    if (values.length >= 2) {
      const first = values[0];
      const last = values[values.length - 1];
      changePct = first === 0 ? 0 : Math.round(((last - first) / Math.abs(first)) * 100);
    }
    out.push({ metricKind: kind, changePct, points: values.length });
  }
  return out;
}
