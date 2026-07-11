/**
 * `integration-lmthing/space.installed` — fires when a space is installed into
 * this project (THING's `installSpace`, or the store install route). Normalizes
 * the pod's `space.installed` internal signal.
 *
 * The pod's signal carries `spaceId` optionally; a signal without it yields no
 * event (an install we can't name isn't worth dispatching).
 */
import type { Emitted, InternalEmitterDef, InternalSignal } from '@lmthing/core';

const def: InternalEmitterDef = {
  type: 'internal',
  on: { signal: 'space.installed' },
  emits: {
    'space.installed': {
      payload: {
        projectId: 'string',
        spaceId: 'string',
      },
    },
  },
  emit(signal: InternalSignal): Emitted[] {
    const d = signal.data as { projectId?: string; spaceId?: string };
    if (typeof d.projectId !== 'string' || typeof d.spaceId !== 'string') return [];
    return [
      {
        event: 'space.installed',
        payload: { projectId: d.projectId, spaceId: d.spaceId },
      },
    ];
  },
};

export default def;
