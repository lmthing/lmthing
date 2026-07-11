/**
 * `integration-lmthing/session.completed` — fires when an lmthing agent session
 * (top-level or headless) finishes in this project. Normalizes the pod's
 * `session.completed` internal signal (`internal-signals.ts`) into a typed event
 * a project hook can subscribe to.
 *
 * The `emit` is PURE (no ctx, no i/o) and runs worker-isolated at dispatch.
 */
import type { Emitted, InternalEmitterDef, InternalSignal } from '@lmthing/core';

const def: InternalEmitterDef = {
  type: 'internal',
  on: { signal: 'session.completed' },
  emits: {
    'session.completed': {
      payload: {
        projectId: 'string',
        agent: 'string',
        sessionId: 'string',
        ok: 'boolean',
        durationMs: 'number',
      },
    },
  },
  emit(signal: InternalSignal): Emitted[] {
    const d = signal.data as {
      projectId?: string;
      agent?: string;
      sessionId?: string;
      ok?: boolean;
      durationMs?: number;
    };
    // Drop the signal if the pod ever emits it without the fields we contract on.
    if (
      typeof d.projectId !== 'string' ||
      typeof d.agent !== 'string' ||
      typeof d.sessionId !== 'string' ||
      typeof d.ok !== 'boolean' ||
      typeof d.durationMs !== 'number'
    ) {
      return [];
    }
    return [
      {
        event: 'session.completed',
        payload: {
          projectId: d.projectId,
          agent: d.agent,
          sessionId: d.sessionId,
          ok: d.ok,
          durationMs: d.durationMs,
        },
      },
    ];
  },
};

export default def;
