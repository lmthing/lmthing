export interface CLIArgs {
  /** Path to user's .ts/.tsx file (positional, optional if --catalog or --space is set) */
  file?: string;
  /** Special instructions appended to system prompt */
  instruct?: string[];
  /** Built-in catalog modules to enable (comma-separated or "all") */
  catalog?: string;
  /** Paths to space directories containing agents/, flows/, knowledge/ */
  spaces?: string[];
  /** Agent slug within a space (requires --space) */
  agent?: string;
  /** Port for WebSocket server + web UI (default: 3010) */
  port: number;
  /** LLM model identifier */
  model?: string;
  /** Session timeout in seconds (default: 600) */
  timeout: number;
  /** Disable serving the web UI (WebSocket-only mode) */
  noUi: boolean;
  /** Path to write a debug log file (JSON or XML based on extension) */
  debugFile?: string;
}

/**
 * Parse CLI arguments from process.argv.
 */
export function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    port: 3010,
    timeout: 600,
    noUi: false,
  };

  const instructs: string[] = [];
  let i = 0;

  // Skip node and script path
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--port" || arg === "-p") {
      args.port = parseInt(argv[++i], 10);
    } else if (arg === "--instruct" || arg === "-i") {
      instructs.push(argv[++i]);
    } else if (arg === "--catalog" || arg === "-c") {
      args.catalog = argv[++i];
    } else if (arg === "--model" || arg === "-m") {
      args.model = argv[++i];
    } else if (arg === "--timeout" || arg === "-t") {
      args.timeout = parseInt(argv[++i], 10);
    } else if (arg === "--debug" || arg === "-d") {
      args.debugFile = argv[++i];
    } else if (arg === "--space" || arg === "-s") {
      if (!args.spaces) args.spaces = [];
      args.spaces.push(argv[++i]);
    } else if (arg === "--agent" || arg === "-a") {
      args.agent = argv[++i];
    } else if (arg === "--no-ui") {
      args.noUi = true;
    } else if (!arg.startsWith("-") && !args.file) {
      args.file = arg;
    }

    i++;
  }

  if (instructs.length > 0) {
    args.instruct = instructs;
  }

  // Validate: --agent requires --space
  if (args.agent && !args.spaces) {
    throw new Error("--agent requires --space");
  }

  // Validate: either file, catalog, space, or agent must be specified
  if (!args.file && !args.catalog && !args.spaces && !args.agent) {
    throw new Error("Either a file path, --catalog, --space, or --agent must be specified");
  }

  return args;
}
