/**
 * `integration-lmthing/project.created` — fires when a new project is created.
 * Normalizes the pod's `project.created` internal signal. This signal has no
 * owning project (the project is the subject), so it fans out to every project
 * that has an `integration-lmthing` def installed (see the fan-out rule in
 * `internal-signals.ts`).
 */
import type { Emitted, InternalEmitterDef, InternalSignal } from '@lmthing/core';

const def: InternalEmitterDef = {
  type: 'internal',
  on: { signal: 'project.created' },
  emits: {
    'project.created': {
      payload: {
        projectId: 'string',
      },
    },
  },
  emit(signal: InternalSignal): Emitted[] {
    const d = signal.data as { projectId?: string };
    if (typeof d.projectId !== 'string') return [];
    return [{ event: 'project.created', payload: { projectId: d.projectId } }];
  },
};

export default def;
