/**
 * config.mjs — an lmauto instance definition. Copy this folder (or run `lmauto new <name>`),
 * then fill the TODOs. Every field is documented in automation/README.md.
 *
 * This skeleton is intentionally runnable as-is: `lmauto run <name> --dry-run` will render a
 * prompt for `task-a` at round 1. Replace the tasks + prompt templates with your real job.
 */
export default {
  // Display name (defaults to the folder name if omitted).
  name: 'TODO-rename-me',

  // Directory the `claude` session runs in (a git repo — its current branch is where the agent
  // commits, exposed to templates as {{branch}}). Defaults to the monorepo root.
  // cwd: '/absolute/path/to/repo',

  // The round-robin task set. Array or a function returning an array (RE-RESOLVED every selection,
  // so appending an item later makes it run its OWN round 1 with the first-round prompt).
  tasks: ['task-a', 'task-b'],

  // Prompt template chosen by the selected task's per-task round.
  firstRoundTemplate: 'prompt.first.md', // round === 1
  nextRoundTemplate: 'prompt.next.md',   // round >= 2
  // Optional: prompt used when a usage limit forces a cross-bin fallback (a DIFFERENT account, so
  // --resume can't be used). Omit to use the engine's built-in continuation wrapper.
  // continueTemplate: 'prompt.continue.md',

  // Human label for the round (drives {{roundMode}}).
  roundMode: (round) => (round <= 1 ? 'CORE BUILD' : 'EXPANSION'),

  // Extra template variables, computed per run. Every key becomes {{KEY}} in the templates.
  // `ctx` = { task, round, roundMode, taskIndex, taskCount, branch, instanceDir, repoRoot }.
  vars: (_ctx) => ({
    // EXAMPLE: SPEC_FILE: `specs/${_ctx.task}.md`,
  }),

  // Subagents the single session should fan out (via its own Task/Agent tool). Rendered into
  // {{subagents}}. Each scope string is itself templated (may contain {{task}} etc.).
  subagents: (_ctx) => [
    // { name: 'builder', scope: 'Implement the core of {{task}}' },
    // { name: 'tester',  scope: 'Write and run tests for {{task}}', model: 'sonnet' },
  ],

  claude: {
    // Backup accounts tried in order; a usage limit on one rotates to the next immediately.
    bins: ['claude'],
    addDirs: [],          // extra --add-dir directories
    flags: ['--verbose'], // extra claude flags
    // model: 'opus',
  },

  prePull: false,     // git pull --ff-only before each run
  interval: 18000,    // seconds between runs in loop mode (5h)
  startDelay: 0,      // seconds before the FIRST run
};
