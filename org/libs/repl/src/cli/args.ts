export interface CLIArgs {
  /** Path to user's .ts/.tsx file (positional, optional if --catalog is set) */
  file?: string
  /** Special instructions appended to system prompt */
  instruct?: string[]
  /** Built-in catalog modules to enable (comma-separated or "all") */
  catalog?: string
  /** Port for WebSocket server + web UI (default: 3100) */
  port: number
  /** LLM model identifier */
  model?: string
  /** Session timeout in seconds (default: 600) */
  timeout: number
}

/**
 * Parse CLI arguments from process.argv.
 */
export function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    port: 3100,
    timeout: 600,
  }

  const instructs: string[] = []
  let i = 0

  // Skip node and script path
  while (i < argv.length) {
    const arg = argv[i]

    if (arg === '--port' || arg === '-p') {
      args.port = parseInt(argv[++i], 10)
    } else if (arg === '--instruct' || arg === '-i') {
      instructs.push(argv[++i])
    } else if (arg === '--catalog' || arg === '-c') {
      args.catalog = argv[++i]
    } else if (arg === '--model' || arg === '-m') {
      args.model = argv[++i]
    } else if (arg === '--timeout' || arg === '-t') {
      args.timeout = parseInt(argv[++i], 10)
    } else if (!arg.startsWith('-') && !args.file) {
      args.file = arg
    }

    i++
  }

  if (instructs.length > 0) {
    args.instruct = instructs
  }

  // Validate: either file or catalog must be specified
  if (!args.file && !args.catalog) {
    throw new Error('Either a file path or --catalog must be specified')
  }

  return args
}
