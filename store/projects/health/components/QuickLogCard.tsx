import React, { useEffect, useRef, useState } from 'react';
import { apiCall, useApiMutation } from '@app/runtime';
import { SparkleIcon, PlusIcon, CheckIcon } from './icons';
import { AIWorking, ErrorNote } from './states';

interface ProposedAction {
  table: string;
  values: Record<string, unknown>;
  summary: string;
}
interface Draft {
  id: string;
  status: string;
  proposedActions: ProposedAction[];
  note?: string;
}

const TABLE_LABEL: Record<string, string> = {
  metrics: 'Measurement',
  symptoms: 'Symptom',
  medications: 'Medication',
  adherence_logs: 'Dose',
};

/**
 * Natural-language "just tell it" logging with confirm-before-write:
 * type a note → the logger parses a reviewable preview → you confirm the rows to
 * write. Falls back to the classic kind/value/unit form for precise entry.
 */
export function QuickLogCard({ onCommitted }: { onCommitted?: () => void }) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [showManual, setShowManual] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const quickLog = useApiMutation<{ draftId: string; status: string }>('quickLog', {});
  const commit = useApiMutation<{ written: number; tables: string[] }>('commitQuickLog', {
    invalidates: ['getAttention', 'healthStats', 'listMetrics', 'listSymptoms', 'listMedications', 'listDoses'],
  });
  const logMetric = useApiMutation('logMetric', {
    invalidates: ['getAttention', 'healthStats', 'listMetrics'],
  });

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = (draftId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const d = (await apiCall('getQuickLogDraft', { id: draftId })) as Draft;
        if (d.status !== 'pending') {
          if (pollRef.current) clearInterval(pollRef.current);
          setParsing(false);
          setDraft(d);
          setAccepted(new Set(d.proposedActions.map((_, i) => i)));
        }
      } catch {
        /* keep polling; a transient read error is fine */
      }
    }, 2500);
  };

  const onParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    setDraft(null);
    setParsing(true);
    try {
      const res = await quickLog.mutate({ text: text.trim() });
      startPolling(res.draftId);
    } catch (err) {
      setParsing(false);
      setError((err as { message?: string })?.message ?? 'Failed to submit.');
    }
  };

  const toggle = (i: number) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const onConfirm = async () => {
    if (!draft) return;
    setError(null);
    try {
      await commit.mutate({ draftId: draft.id, acceptedIndices: [...accepted] });
      setDraft(null);
      setText('');
      onCommitted?.();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Failed to save.');
    }
  };

  const onCancel = () => {
    setDraft(null);
    setText('');
    setError(null);
  };

  const [mKind, setMKind] = useState('weight');
  const [mValue, setMValue] = useState('');
  const [mUnit, setMUnit] = useState('kg');
  const onManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mValue.trim() || !mUnit.trim()) return;
    try {
      await logMetric.mutate({ kind: mKind, value: Number(mValue), unit: mUnit.trim() });
      setMValue('');
      onCommitted?.();
    } catch {
      /* surfaced below */
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="text-agent">
          <SparkleIcon className="h-4 w-4" />
        </span>
        <p className="text-sm font-bold text-foreground">Quick log</p>
      </div>

      {!draft && !parsing ? (
        <form onSubmit={onParse} className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Just tell it — e.g. slept 6.5h, weight 82kg, took my atorvastatin, mild headache since lunch"
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={quickLog.isPending || !text.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <SparkleIcon className="h-4 w-4" />
              Parse & review
            </button>
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {showManual ? 'Hide manual entry' : 'Manual entry'}
            </button>
          </div>
        </form>
      ) : null}

      {parsing ? <AIWorking agent="The logger" label="Reading your note…" hint="Parsing into reviewable entries — you confirm before anything is saved." /> : null}

      {draft ? (
        <div className="space-y-3">
          {draft.proposedActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {draft.note ?? "I couldn't find anything to log — try rephrasing."}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Review what I understood. Uncheck anything you don't want, then confirm.
              </p>
              <ul className="space-y-1.5">
                {draft.proposedActions.map((a, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={accepted.has(i)}
                        onChange={() => toggle(i)}
                        className="mt-0.5 accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          {TABLE_LABEL[a.table] ?? a.table}
                        </span>
                        <span className="text-foreground">{a.summary}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="flex gap-2">
            {draft.proposedActions.length > 0 ? (
              <button
                type="button"
                onClick={onConfirm}
                disabled={commit.isPending || accepted.size === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <CheckIcon className="h-4 w-4" />
                {commit.isPending ? 'Saving…' : `Confirm ${accepted.size}`}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-4 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}

      {showManual && !draft && !parsing ? (
        <form onSubmit={onManual} className="space-y-2 border-t border-border pt-3">
          <div className="flex gap-2">
            <select
              value={mKind}
              onChange={(e) => setMKind(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="weight">Weight</option>
              <option value="resting_hr">Resting heart rate</option>
              <option value="sleep_hours">Sleep hours</option>
              <option value="bp_systolic">Blood pressure (systolic)</option>
              <option value="steps">Steps</option>
            </select>
            <input
              value={mValue}
              onChange={(e) => setMValue(e.target.value)}
              placeholder="Value"
              type="number"
              className="w-28 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <input
              value={mUnit}
              onChange={(e) => setMUnit(e.target.value)}
              placeholder="Unit"
              className="w-20 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={logMetric.isPending || !mValue.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {logMetric.isPending ? 'Logging…' : 'Log measurement'}
          </button>
        </form>
      ) : null}
    </div>
  );
}

export default QuickLogCard;
