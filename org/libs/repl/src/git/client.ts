/**
 * Simple Git client for auto-committing file changes.
 *
 * Uses node:child_process to run git commands without external dependencies.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface GitClientOptions {
  /** Working directory (repo root). Defaults to process.cwd(). */
  workingDir?: string;
  /** Author name for commits. */
  authorName?: string;
  /** Author email for commits. */
  authorEmail?: string;
}

export interface GitCommitResult {
  ok: boolean;
  hash?: string;
  error?: string;
}

export interface GitStatusResult {
  exists: boolean;
  isRepo: boolean;
  hasChanges: boolean;
  branch?: string;
}

/**
 * Simple Git client for auto-committing agent file changes.
 */
export class GitClient {
  private workingDir: string;
  private authorName: string;
  private authorEmail: string;

  constructor(options: GitClientOptions = {}) {
    this.workingDir = options.workingDir ?? process.cwd();
    this.authorName = options.authorName ?? 'THING Agent';
    this.authorEmail = options.authorEmail ?? 'agent@lmthing.local';
  }

  /**
   * Check if git repo exists and has changes.
   */
  async getStatus(): Promise<GitStatusResult> {
    try {
      // Check if we're in a git repo
      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.workingDir,
      });

      // Check for changes
      const { stdout: status } = await execAsync('git status --porcelain', {
        cwd: this.workingDir,
      });

      return {
        exists: true,
        isRepo: true,
        hasChanges: status.trim().length > 0,
        branch: branch.trim(),
      };
    } catch (err: any) {
      // Not a git repo or git not available
      return { exists: false, isRepo: false, hasChanges: false };
    }
  }

  /**
   * Stage and commit a file change with a descriptive message.
   */
  async commitFile(filePath: string, message: string): Promise<GitCommitResult> {
    try {
      // Stage the file
      await execAsync(`git add "${filePath}"`, {
        cwd: this.workingDir,
      });

      // Commit with author info
      const author = `${this.authorName} <${this.authorEmail}>`;
      await execAsync(
        `git commit -m "${message}" --author="${author}" --no-verify`,
        { cwd: this.workingDir }
      );

      // Get the commit hash using rev-parse
      const { stdout: hash } = await execAsync('git rev-parse --short HEAD', {
        cwd: this.workingDir,
      });

      return { ok: true, hash: hash.trim() };
    } catch (err: any) {
      return {
        ok: false,
        error: err.stderr || err.message || 'Git commit failed',
      };
    }
  }

  /**
   * Stage and commit multiple files at once.
   */
  async commitFiles(filePaths: string[], message: string): Promise<GitCommitResult> {
    try {
      // Stage all files
      const paths = filePaths.map((p) => `"${p}"`).join(' ');
      await execAsync(`git add ${paths}`, {
        cwd: this.workingDir,
      });

      // Commit
      const author = `${this.authorName} <${this.authorEmail}>`;
      await execAsync(
        `git commit -m "${message}" --author="${author}" --no-verify`,
        { cwd: this.workingDir }
      );

      // Get the commit hash using rev-parse
      const { stdout: hash } = await execAsync('git rev-parse --short HEAD', {
        cwd: this.workingDir,
      });

      return { ok: true, hash: hash.trim() };
    } catch (err: any) {
      return {
        ok: false,
        error: err.stderr || err.message || 'Git commit failed',
      };
    }
  }

  /**
   * Get the current git status as a string.
   * Only shows changes to tracked files (not untracked files).
   */
  async getStatusString(): Promise<string> {
    try {
      const { stdout } = await execAsync('git diff --name-status', {
        cwd: this.workingDir,
      });
      return stdout.trim();
    } catch {
      return '';
    }
  }

  /**
   * Check if a specific file has uncommitted changes.
   */
  async isFileChanged(filePath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`git status --porcelain "${filePath}"`, {
        cwd: this.workingDir,
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Create a default git client for auto-commits.
 */
export function createGitClient(options?: GitClientOptions): GitClient {
  return new GitClient(options);
}
