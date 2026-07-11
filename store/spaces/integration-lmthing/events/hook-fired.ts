/**
 * `integration-lmthing/hook.fired` — fires when one of this project's hooks runs.
 * Normalizes the pod's `hook.fired` internal signal (emitted by the hook
 * dispatcher). Useful for auditing automations from within an automation.
 *
 * Loop protection is handled upstream: the pod threads the firing hook's slug
 * so a `hook.fired`-derived event can never re-trigger the very hook that fired
 * it, and the cascade depth cap bounds the chain (see `internal-signals.ts`).
 */
import type { Emitted, InternalEmitterDef, InternalSignal } from '@lmthing/core';

const def: InternalEmitterDef = {
  type: 'internal',
  on: { signal: 'hook.fired' },
  emits: {
    'hook.fired': {
      payload: {
        projectId: 'string',
        slug: 'string',
        hookType: 'string',
      },
    },
  },
  emit(signal: InternalSignal): Emitted[] {
    const d = signal.data as { projectId?: string; slug?: string; hookType?: string };
    if (
      typeof d.projectId !== 'string' ||
      typeof d.slug !== 'string' ||
      typeof d.hookType !== 'string'
    ) {
      return [];
    }
    return [
      {
        event: 'hook.fired',
        payload: { projectId: d.projectId, slug: d.slug, hookType: d.hookType },
      },
    ];
  },
};

export default def;
