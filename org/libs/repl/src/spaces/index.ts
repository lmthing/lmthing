/**
 * Space creation utilities for agent-generated spaces.
 *
 * Provides helpers for creating complete space structures using file blocks.
 */

export {
  generatePackageJson,
  generateAgentConfig,
  generateSpaceStructure,
  generateSpaceFileBlocks,
  validateSpaceName,
  slugifySpaceName,
} from './creator';

export type { SpaceMetadata, AgentDefinition } from './creator';

// Space watching for hot-reload
export { watchSpaces, isFileWatchingSupported } from './watcher';
export type { SpaceWatcherOptions, SpaceWatcherHandle } from './watcher';

// Dynamic space loader
export { createDynamicSpaceLoader } from './dynamic-loader';
export type { DynamicSpaceLoaderOptions, DynamicSpaceLoaderHandle } from './dynamic-loader';
