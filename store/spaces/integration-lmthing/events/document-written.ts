/**
 * `integration-lmthing/document.written` — fires when a document is written in
 * this project (VFS / project doc write seam). Normalizes the pod's
 * `document.written` internal signal. `path` is the written document's path.
 */
import type { Emitted, InternalEmitterDef, InternalSignal } from '@lmthing/core';

const def: InternalEmitterDef = {
  type: 'internal',
  on: { signal: 'document.written' },
  emits: {
    'document.written': {
      payload: {
        projectId: 'string',
        path: 'string',
      },
    },
  },
  emit(signal: InternalSignal): Emitted[] {
    const d = signal.data as { projectId?: string; path?: string };
    if (typeof d.projectId !== 'string' || typeof d.path !== 'string') return [];
    return [
      {
        event: 'document.written',
        payload: { projectId: d.projectId, path: d.path },
      },
    ];
  },
};

export default def;
