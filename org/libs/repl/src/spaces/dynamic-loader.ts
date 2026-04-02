/**
 * Dynamic space loader — hot-reload spaces and update namespaces.
 *
 * Provides utilities to watch space directories and update Session
 * with new agent namespaces when spaces change.
 */

import type { Session } from '../session/session';
import type { AgentSpawnConfig, AgentSpawnResult } from '../session/types';

export interface DynamicSpaceLoaderOptions {
  /** Root directory containing spaces. */
  spacesDir: string;
  /** Session to update with new namespaces. */
  session: Session;
  /** Callback for spawning agents when namespaces are called. */
  onSpawn: (config: AgentSpawnConfig) => Promise<AgentSpawnResult>;
  /** Log callback for reload events. */
  onReload?: (spaceName: string) => void;
  /** Function to rebuild agent namespaces from spaces directory. */
  rebuildNamespaces: (spacesDir: string) => Promise<{
    agentTree: Record<string, unknown>;
    knowledgeNamespace: Record<string, unknown>;
  }>;
}

export interface DynamicSpaceLoaderHandle {
  /** Start watching spaces. */
  start: () => Promise<void>;
  /** Stop watching spaces. */
  stop: () => Promise<void>;
  /** Manually trigger a reload of all spaces. */
  reload: () => Promise<void>;
  /** Check if currently watching. */
  isWatching: () => boolean;
}

/**
 * Create a dynamic space loader that watches for changes and updates namespaces.
 */
export function createDynamicSpaceLoader(
  options: DynamicSpaceLoaderOptions,
): DynamicSpaceLoaderHandle {
  const { spacesDir, session, onSpawn, onReload, rebuildNamespaces } = options;
  let watcherHandle: Awaited<ReturnType<typeof import('./watcher').watchSpaces>> | null = null;
  let watching = false;

  async function rebuildAndInject() {
    // Build agent namespaces from all spaces using the provided callback
    const { agentTree, knowledgeNamespace } = await rebuildNamespaces(spacesDir);

    // Update session with new namespaces
    // Note: This requires Session to have an updateNamespaces method
    // For now, we'll inject directly into the sandbox
    const sessionAny = session as any;

    // Clear existing namespace globals and inject new ones
    // (This is a simplified approach - ideally Session would have updateNamespaces())
    for (const [name, ns] of Object.entries(agentTree)) {
      sessionAny.sandbox?.inject(name, ns);
    }

    // Inject knowledge namespace
    if (knowledgeNamespace) {
      sessionAny.sandbox?.inject('knowledge', knowledgeNamespace);
    }
  }

  async function handleSpaceChange(spaceName: string) {
    onReload?.(spaceName);
    await rebuildAndInject();
  }

  return {
    async start() {
      if (watching) return;

      // Import watcher dynamically to avoid circular deps
      const { watchSpaces, isFileWatchingSupported } = await import('./watcher');

      if (!isFileWatchingSupported()) {
        console.warn('File watching not supported in this environment');
        return;
      }

      watcherHandle = await watchSpaces({
        spacesDir,
        onChange: handleSpaceChange,
      });

      watching = true;
    },

    async stop() {
      if (!watching) return;
      await watcherHandle?.stop();
      watcherHandle = null;
      watching = false;
    },

    async reload() {
      await rebuildAndInject();
    },

    isWatching: () => watching,
  };
}
