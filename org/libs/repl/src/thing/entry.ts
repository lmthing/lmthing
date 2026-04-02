/**
 * THING Agent Entry Point — main interface for agent interactions.
 *
 * Provides the primary entry point for THING agent sessions,
 * with built-in spaces and common task helpers.
 */

import { Session } from '../session/session';
import type { SessionOptions } from '../session/session';
import type { GitClient } from '../git/client';
import { createGitClient } from '../git/client';

export interface ThingEntryPointOptions extends Omit<SessionOptions, 'gitClient' | 'autoCommit'> {
  /** Git client for auto-committing file writes. */
  gitClient?: GitClient;
  /** Auto-commit files after writes (default: true). */
  autoCommit?: boolean;
}

/**
 * Create a THING agent session with standard configuration.
 *
 * This is the main entry point for creating THING agent sessions,
 * with sensible defaults and built-in integrations.
 */
export function createThingSession(options: ThingEntryPointOptions = {}): Session {
  // Set defaults
  const sessionOptions: SessionOptions = {
    ...options,
    gitClient: options.gitClient,
    autoCommit: options.autoCommit ?? true,
  };

  return new Session(sessionOptions);
}

/**
 * Quick start — create a THING agent with minimal setup.
 *
 * @param workingDir — Working directory for file operations
 * @param gitAutoCommit — Enable git auto-commit (default: true)
 */
export function quickStart(workingDir?: string, gitAutoCommit = true): Session {
  const gitClient = gitAutoCommit ? createGitClient({ workingDir }) : undefined;

  return createThingSession({
    gitClient,
    autoCommit: gitAutoCommit,
    fileWorkingDir: workingDir,
  });
}

/**
 * THING Agent Entry Point Class
 *
 * Wraps a Session with THING-specific convenience methods.
 */
export class ThingAgent {
  private session: Session;

  constructor(options: ThingEntryPointOptions = {}) {
    this.session = new Session(options);
  }

  /**
   * Send a user message to the agent.
   */
  async sendMessage(text: string): Promise<void> {
    return this.session.handleUserMessage(text);
  }

  /**
   * Get the underlying session.
   */
  getSession(): Session {
    return this.session;
  }

  /**
   * Get the agent's current scope.
   */
  getScope(): string {
    return this.session.getScopeTable();
  }

  /**
   * Get pinned memory.
   */
  getPinned(): Map<string, { value: unknown; display: string; turn: number }> {
    return this.session.getPinnedMemory();
  }

  /**
   * Get agent memos.
   */
  getMemos(): Map<string, string> {
    return this.session.getMemoMemory();
  }

  /**
   * Check if agent is currently processing.
   */
  isBusy(): boolean {
    return this.session.getStatus() !== 'idle';
  }

  /**
   * Get agent status.
   */
  getStatus(): string {
    return this.session.getStatus();
  }

  /**
   * Destroy the agent session.
   */
  destroy(): void {
    this.session.destroy();
  }
}
