/**
 * Per-model Azure token usage and cost, bucketed by hour or day, as CSV.
 *
 * Usage comes from Azure Monitor (the platform metrics the AI Services account emits);
 * price comes from sdk/org/libs/cli/prices/azure.json (refresh it with `pnpm
 * fetch-azure-prices` in libs/cli). Azure Monitor does NOT report cost, and Cost
 * Management does not break spend down by model deployment — so cost here is always
 * tokens × price, i.e. an ESTIMATE, not your invoice.
 *
 * Usage:
 *   npx tsx scripts/azure-usage-cost.ts                        # last 10 days, daily → stdout
 *   npx tsx scripts/azure-usage-cost.ts --granularity hour     # hourly buckets
 *   npx tsx scripts/azure-usage-cost.ts --days 30 --out usage.csv
 *   npx tsx scripts/azure-usage-cost.ts --start 2026-07-11 --end 2026-07-13 --granularity hour
 *   npx tsx scripts/azure-usage-cost.ts --markup               # add the 15% gateway markup
 *   npx tsx scripts/azure-usage-cost.ts --model DeepSeek-V4-Pro
 *
 * Requires: `az login` (reads the account via the Azure CLI).
 *
 * ── Two facts the arithmetic depends on ─────────────────────────────────────────
 *
 * 1. `cacheReadInputTokens` is a SUBSET of `InputTokens`, not an additional bucket.
 *    (Checks out against the metric itself: TotalTokens == InputTokens + OutputTokens
 *    exactly, while cacheRead sits inside InputTokens.) So billable input is
 *    `InputTokens - cacheReadInputTokens`, and double-counting it would overstate cost.
 *
 * 2. A model with no `cachedInputPer1K` on file has no published cache-read meter. We
 *    then price its cached tokens at the FULL input rate — an upper bound, flagged per
 *    row in the `priced` column as `no-cache-price` so it is never mistaken for exact.
 *
 * A model with no price at all (gpt-5.4-nano; whisper/tts, which are not token-priced)
 * emits EMPTY cost cells and `priced=unpriced`. It never emits a zero: a zero would
 * silently under-count a total, an empty cell cannot.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICES_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../sdk/org/libs/cli/prices/azure.json',
);

/** Gateway markup over provider cost — keep in sync with cloud/scripts/generate-litellm-models.ts. */
const MARKUP = 1.15;

/**
 * `--source billing`: ACTUAL billed cost from Cost Management, grouped by meter.
 *
 * This is the only way to cost whisper and tts. They are not token-priced (whisper bills
 * per audio hour, tts per character) and — verified against this account — Azure Monitor's
 * audio metrics (`AudioSecondsTranscribed`, `ProcessedAudioMinutes`) stay at ZERO for an
 * Azure OpenAI whisper *deployment* even across successful 200s, because those metrics
 * belong to the Speech service. There is no token or duration metric to multiply, so no
 * price could rescue the estimate; the billed meter is the only source of truth.
 *
 * It is also a reality check on the token×price estimate, which on settled days runs
 * ~5-12% high — partly because `cacheReadInputTokens` does not populate for gpt-5.5 even
 * though its `cd inp` meter is genuinely billed, so the estimator prices cache hits it
 * cannot see at the full input rate.
 *
 * Caveat: cost data LAGS. The most recent day or two are ingested only partially and will
 * under-report badly (07-13 came in at 43% of its settled value the morning after). Trust
 * billing for anything older than ~48h; use metrics for "what happened just now".
 */
const COST_API = '2023-11-01';

/** Meter → model. Meters carry no model name (`5.5 ShortCo inp Gl`), so map by pattern. */
const METER_MODEL: [RegExp, string][] = [
  [/^V4 Pro /i, 'DeepSeek-V4-Pro'],
  [/^V4 Flash /i, 'DeepSeek-V4-Flash'],
  [/^R1 /i, 'DeepSeek-R1-0528'],
  [/^K2\.6/i, 'Kimi-K2.6'],
  [/^5\.5 /i, 'gpt-5.5'],
  [/^5\.4 nano/i, 'gpt-5.4-nano'],
  [/^5\.4 mini/i, 'gpt-5.4-mini'],
  [/^5\.4 /i, 'gpt-5.4'],
  [/^gpt[ -]4\.1 mini/i, 'gpt-4.1-mini'],
  [/^gpt[ -]4o/i, 'gpt-4o'],
  [/whisper/i, 'whisper'],
  [/text to speech|neural text to speech/i, 'tts'],
];

const meterModel = (m: string) => METER_MODEL.find(([re]) => re.test(m))?.[1] ?? 'other';

/** Which side of the bill a meter is: cached MUST be tested before input (`cd inp` has both). */
function meterComponent(m: string): string {
  const n = m.toLowerCase();
  if (/\bcd\b|\bcache\b|\bcached\b|\bch\b/.test(n)) return 'cached';
  if (/\binp\b|\binput\b/.test(n)) return 'input';
  if (/\boutp\b|\bopt\b|\boutput\b/.test(n)) return 'output';
  if (/character|unit|hour/.test(n)) return 'usage'; // whisper (audio-hours), tts (characters)
  return 'other';
}

/** Metrics we pull. All are Total-aggregated counts, split by ModelDeploymentName. */
const METRICS = ['InputTokens', 'OutputTokens', 'TotalTokens', 'ModelRequests', 'cacheReadInputTokens'];

interface ModelPricing {
  inputPer1K: number;
  outputPer1K: number;
  cachedInputPer1K?: number;
}

interface Args {
  account: string;
  resourceGroup?: string;
  granularity: 'hour' | 'day';
  days: number;
  start?: string;
  end?: string;
  out?: string;
  markup: boolean;
  model?: string;
  source: 'metrics' | 'billing';
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    account: 'lmthing-resource', granularity: 'day', days: 10, markup: false, source: 'metrics',
  };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i + 1];
    switch (argv[i]) {
      case '--account': a.account = v!; i++; break;
      case '--resource-group': case '-g': a.resourceGroup = v!; i++; break;
      case '--source': {
        if (v !== 'metrics' && v !== 'billing') throw new Error(`--source must be metrics|billing, got '${v}'`);
        a.source = v; i++; break;
      }
      case '--granularity': {
        if (v !== 'hour' && v !== 'day') throw new Error(`--granularity must be hour|day, got '${v}'`);
        a.granularity = v; i++; break;
      }
      case '--days': a.days = Number(v); i++; break;
      case '--start': a.start = v!; i++; break;
      case '--end': a.end = v!; i++; break;
      case '--out': case '-o': a.out = v!; i++; break;
      case '--model': a.model = v!; i++; break;
      case '--markup': a.markup = true; break;
      case '--help': case '-h': printHelp(); process.exit(0);
      default: throw new Error(`unknown flag: ${argv[i]}`);
    }
  }
  if (!Number.isFinite(a.days) || a.days <= 0) throw new Error('--days must be a positive number');
  if (a.source === 'billing' && a.granularity === 'hour') {
    throw new Error('--source billing supports only --granularity day (Cost Management has no hourly grain)');
  }
  return a;
}

function printHelp() {
  console.log(`azure-usage-cost — per-model usage + cost as CSV

  --source metrics|billing ESTIMATE from tokens x price, or ACTUAL billed cost
                           (default: metrics. billing = day-grain only, lags ~48h,
                            and is the ONLY way to cost whisper/tts)
  --granularity hour|day   bucket size            (default: day)
  --days N                 look back N days       (default: 10; Azure keeps ~93)
  --start / --end          explicit ISO window    (overrides --days)
  --model NAME             only this deployment
  --markup                 apply the ${MARKUP}x gateway markup (metrics source only)
  --account NAME           AI Services account    (default: lmthing-resource)
  -g, --resource-group     (default: auto-resolved from the account)
  -o, --out FILE           write CSV here         (default: stdout)`);
}

/** Actual billed cost per meter per day, straight from Cost Management. */
function fetchBilling(rid: string, start: Date, end: Date) {
  const sub = rid.split('/')[2];
  const body = {
    type: 'ActualCost',
    timeframe: 'Custom',
    timePeriod: { from: iso(start), to: iso(end) },
    dataset: {
      granularity: 'Daily',
      aggregation: { totalCost: { name: 'Cost', function: 'Sum' } },
      grouping: [{ type: 'Dimension', name: 'Meter' }],
      filter: { dimensions: { name: 'ResourceId', operator: 'In', values: [rid] } },
    },
  };
  const tmp = join(tmpdir(), `cmq-${process.pid}.json`);
  writeFileSync(tmp, JSON.stringify(body));
  try {
    const raw = az([
      'rest', '--method', 'post',
      '--url', `https://management.azure.com/subscriptions/${sub}/providers/Microsoft.CostManagement/query?api-version=${COST_API}`,
      '--body', `@${tmp}`,
      '--headers', 'Content-Type=application/json',
      '-o', 'json',
    ]);
    const d = JSON.parse(raw) as { properties: { rows: [number, number, string, string][] } };
    return d.properties.rows;
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** `--source billing` → one row per (day, model, component, meter) with real money on it. */
function runBilling(args: Args, rid: string, start: Date, end: Date): string {
  const rows = fetchBilling(rid, start, end);
  const out: string[] = ['timestamp,model,component,meter,cost,currency'];
  const byModel = new Map<string, number>();
  let currency = '';
  let total = 0;

  for (const [cost, day, meter, cur] of rows.sort((a, b) => a[1] - b[1] || a[2].localeCompare(b[2]))) {
    const model = meterModel(meter);
    if (args.model && model !== args.model) continue;
    const s = String(day); // YYYYMMDD
    const ts = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    currency = cur;
    total += cost;
    byModel.set(model, (byModel.get(model) ?? 0) + cost);
    // Quote the meter: names contain commas in some families.
    out.push([ts, model, meterComponent(meter), `"${meter}"`, cost.toFixed(6), cur].join(','));
  }

  const log = args.out ? console.log : console.error;
  log(`\nACTUAL billed cost: ${total.toFixed(2)} ${currency}  (${iso(start)} → ${iso(end)})`);
  for (const [m, c] of [...byModel.entries()].sort((a, b) => b[1] - a[1])) {
    if (c >= 0.005) log(`  ${m.padEnd(20)} ${c.toFixed(2).padStart(9)} ${currency}`);
  }
  log('\nCost Management lags: the last ~48h are partially ingested and WILL under-report.');
  return out.join('\n') + '\n';
}

function az(args: string[]): string {
  return execFileSync('az', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Resolve the account's ARM id, discovering its resource group when not given. */
function resourceId(account: string, group?: string): string {
  if (group) {
    return az(['cognitiveservices', 'account', 'show', '-n', account, '-g', group, '--query', 'id', '-o', 'tsv']).trim();
  }
  const list = JSON.parse(az(['cognitiveservices', 'account', 'list', '-o', 'json'])) as {
    name: string; id: string;
  }[];
  const hit = list.find((r) => r.name === account);
  if (!hit) {
    throw new Error(`account '${account}' not found. Available: ${list.map((r) => r.name).join(', ') || '(none)'}`);
  }
  return hit.id;
}

interface Bucket { requests: number; input: number; output: number; total: number; cached: number }
const emptyBucket = (): Bucket => ({ requests: 0, input: 0, output: 0, total: 0, cached: 0 });

const METRIC_FIELD: Record<string, keyof Bucket> = {
  ModelRequests: 'requests',
  InputTokens: 'input',
  OutputTokens: 'output',
  TotalTokens: 'total',
  cacheReadInputTokens: 'cached',
};

/**
 * One `az monitor metrics list` call. Hourly windows are requested a slice at a time by
 * the caller: the metrics API caps how many data points one response may carry, and a
 * wide hourly window silently comes back truncated rather than erroring.
 */
function fetchWindow(rid: string, startIso: string, endIso: string, interval: string) {
  const raw = az([
    'monitor', 'metrics', 'list',
    '--resource', rid,
    '--metrics', ...METRICS,
    '--filter', "ModelDeploymentName eq '*'",
    '--start-time', startIso,
    '--end-time', endIso,
    '--interval', interval,
    '--aggregation', 'Total',
    '-o', 'json',
  ]);
  return JSON.parse(raw) as {
    value: {
      name: { value: string };
      timeseries: {
        metadatavalues: { name: { value: string }; value: string }[];
        data: { timeStamp: string; total?: number }[];
      }[];
    }[];
  };
}

/** Slice [start,end) into chunks so an hourly query never overruns the API's point cap. */
function slices(start: Date, end: Date, granularity: 'hour' | 'day'): [Date, Date][] {
  if (granularity === 'day') return [[start, end]];
  const out: [Date, Date][] = [];
  const CHUNK_MS = 2 * 24 * 3600 * 1000; // 2 days of hourly buckets per call
  for (let t = start.getTime(); t < end.getTime(); t += CHUNK_MS) {
    out.push([new Date(t), new Date(Math.min(t + CHUNK_MS, end.getTime()))]);
  }
  return out;
}

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const money = (n: number) => n.toFixed(6);

function main() {
  const args = parseArgs(process.argv.slice(2));
  const prices: Record<string, ModelPricing> = JSON.parse(readFileSync(PRICES_PATH, 'utf8'));

  let end = args.end ? new Date(args.end) : new Date();
  let start = args.start
    ? new Date(args.start)
    : new Date(end.getTime() - args.days * 24 * 3600 * 1000);

  // Azure anchors P1D buckets to the window START, so an unsnapped window yields buckets
  // labelled 21:53 that straddle two calendar days. Snap to UTC midnight so a "day" is a day.
  if (args.granularity === 'day') {
    start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    end = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1));
  }
  if (!(start < end)) throw new Error(`--start (${iso(start)}) must precede --end (${iso(end)})`);

  const rid = resourceId(args.account, args.resourceGroup);

  if (args.source === 'billing') {
    const csv = runBilling(args, rid, start, end);
    if (args.out) {
      writeFileSync(args.out, csv);
      console.log(`Wrote ${args.out}`);
    } else {
      process.stdout.write(csv);
    }
    return;
  }

  const interval = args.granularity === 'hour' ? 'PT1H' : 'P1D';

  // bucket[timestamp][model] → tallies
  const buckets = new Map<string, Map<string, Bucket>>();

  for (const [s, e] of slices(start, end, args.granularity)) {
    const res = fetchWindow(rid, iso(s), iso(e), interval);
    for (const metric of res.value) {
      const field = METRIC_FIELD[metric.name.value];
      if (!field) continue;
      for (const series of metric.timeseries) {
        const model = series.metadatavalues.find(
          (m) => m.name.value.toLowerCase() === 'modeldeploymentname',
        )?.value;
        // `__Empty` is traffic with no model dimension (account-level calls) — not a model.
        if (!model || model === '__Empty') continue;
        if (args.model && model !== args.model) continue;
        for (const p of series.data) {
          if (!p.total) continue;
          const ts = p.timeStamp;
          if (!buckets.has(ts)) buckets.set(ts, new Map());
          const byModel = buckets.get(ts)!;
          if (!byModel.has(model)) byModel.set(model, emptyBucket());
          byModel.get(model)![field] += p.total;
        }
      }
    }
  }

  const rows: string[] = [
    [
      'timestamp', 'model', 'requests',
      'input_tokens', 'cached_input_tokens', 'billable_input_tokens', 'output_tokens', 'total_tokens',
      'input_cost_usd', 'cached_cost_usd', 'output_cost_usd', 'total_cost_usd',
      'priced',
    ].join(','),
  ];

  const unpriced = new Set<string>();
  const noCachePrice = new Set<string>();
  let grand = 0;

  for (const ts of [...buckets.keys()].sort()) {
    const byModel = buckets.get(ts)!;
    for (const model of [...byModel.keys()].sort()) {
      const b = byModel.get(model)!;
      const p = prices[model];
      // cacheRead is a subset of InputTokens — subtract, never add.
      const billableInput = Math.max(0, b.input - b.cached);

      if (!p) {
        unpriced.add(model);
        rows.push([
          ts, model, b.requests,
          b.input, b.cached, billableInput, b.output, b.total,
          '', '', '', '', 'unpriced',
        ].join(','));
        continue;
      }

      // No published cache meter ⇒ cached tokens bill at the full input rate (upper bound).
      const cachedRate = p.cachedInputPer1K ?? p.inputPer1K;
      const flag = p.cachedInputPer1K == null && b.cached > 0 ? 'no-cache-price' : 'full';
      if (flag === 'no-cache-price') noCachePrice.add(model);

      const m = args.markup ? MARKUP : 1;
      const inCost = (billableInput / 1000) * p.inputPer1K * m;
      const cachedCost = (b.cached / 1000) * cachedRate * m;
      const outCost = (b.output / 1000) * p.outputPer1K * m;
      const totalCost = inCost + cachedCost + outCost;
      grand += totalCost;

      rows.push([
        ts, model, b.requests,
        b.input, b.cached, billableInput, b.output, b.total,
        money(inCost), money(cachedCost), money(outCost), money(totalCost),
        flag,
      ].join(','));
    }
  }

  const csv = rows.join('\n') + '\n';
  if (args.out) {
    writeFileSync(args.out, csv);
    console.log(`Wrote ${args.out} — ${rows.length - 1} rows, ${iso(start)} → ${iso(end)}, per ${args.granularity}`);
  } else {
    process.stdout.write(csv);
  }

  const log = args.out ? console.log : console.error; // keep stderr clean of CSV on stdout
  log(`\nEstimated total: $${grand.toFixed(2)}${args.markup ? ` (incl. ${MARKUP}x markup)` : ' (base Azure price)'}`);
  log('Cost is tokens x price from prices/azure.json, not billed cost from your invoice.');
  if (noCachePrice.size) {
    log(`Upper bound for: ${[...noCachePrice].join(', ')} — no published cache-read meter, so cached tokens priced at the full input rate.`);
  }
  if (unpriced.size) {
    log(`No price on file, cost cells left EMPTY: ${[...unpriced].join(', ')}. Their usage is real but uncosted.`);
  }
}

try {
  main();
} catch (err) {
  console.error('Error:', (err as Error).message);
  process.exit(1);
}
