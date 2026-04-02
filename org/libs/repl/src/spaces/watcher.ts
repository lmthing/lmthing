/**
 * Space watcher — hot-reload spaces when files change.
 *
 * Watches space directories for changes and triggers rebuilds
 * of agent namespaces without requiring session restart.
 */

import { watch } from 'node:fs/promises';
import { join } from 'node:path';

export interface SpaceWatcherOptions {
  /** Root directory containing spaces. */
  spacesDir: string;
  /** Callback when a space changes. */
  onChange: (spaceName: string) => void | Promise<void>;
  /** Debounce delay in ms (default: 300). */
  debounceMs?: number;
  /** Whether to watch recursively (default: true). */
  recursive?: boolean;
}

export interface SpaceWatcherHandle {
  /** Stop watching. */
  stop: () => Promise<void>;
  /** Check if currently watching. */
  isWatching: () => boolean;
}

/**
 * Watch spaces directory for changes.
 */
export async function watchSpaces(
  options: SpaceWatcherOptions,
): Promise<SpaceWatcherHandle> {
  const { spacesDir, onChange, debounceMs = 300, recursive = true } = options;

  let watching = true;
  let abortController = new AbortController();
  let timeoutMap = new Map<string, NodeJS.Timeout>();

  // Map file paths to space names
  function getSpaceName(filePath: string): string | null {
    const relative = filePath.replace(spacesDir, '').replace(/^[\/\\]+/, '');
    const segments = relative.split(/[\/\\]/);
    if (segments.length === 0) return null;
    // First segment is the space name
    const spaceName = segments[0];
    // Validate it looks like a space (has package.json)
    return spaceName;
  }

  const watcher = watch(spacesDir, {
    recursive,
    signal: abortController.signal,
  });

  (async () => {
    try {
      for await (const event of watcher) {
        if (!watching) break;

        const eventType = event.eventType;
        const filename = event.filename;

        if (!filename) continue;

        const fullPath = join(spacesDir, filename);
        const spaceName = getSpaceName(fullPath);

        if (!spaceName) continue;

        // Debounce changes per space
        const existing = timeoutMap.get(spaceName);
        if (existing) {
          clearTimeout(existing);
        }

        const timeout = setTimeout(async () => {
          try {
            await onChange(spaceName);
          } catch (err) {
            console.error(`Error reloading space ${spaceName}:`, err);
          }
          timeoutMap.delete(spaceName);
        }, debounceMs);

        timeoutMap.set(spaceName, timeout);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Expected when stopping
      } else {
        console.error('Space watcher error:', err);
      }
    }
  })();

  return {
    async stop() {
      watching = false;
      abortController.abort();
      // Clear all pending timeouts
      for (const timeout of timeoutMap.values()) {
        clearTimeout(timeout);
      }
      timeoutMap.clear();
    },
    isWatching: () => watching,
  };
}

/**
 * Check if file watching is supported (not available in all environments).
 */
export function isFileWatchingSupported(): boolean {
  // Node.js 15.6+ supports fs.watch() with promises
  // Some environments (like some containers) may not support it
  try {
    return typeof watch === 'function';
  } catch {
    return false;
  }
}
