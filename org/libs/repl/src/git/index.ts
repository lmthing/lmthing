/**
 * Git client for auto-committing file changes.
 *
 * Provides a simple git client that can auto-commit files when the agent
 * writes them using 4-backtick file blocks.
 */

export { GitClient, createGitClient } from './client';
export type { GitClientOptions, GitCommitResult, GitStatusResult } from './client';
