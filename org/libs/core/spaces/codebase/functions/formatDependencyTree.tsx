/**
 * Formats the dependency relationships for a package in the lmthing monorepo.
 * Shows what the package depends on and what depends on it.
 *
 * @param packageName - Package name or alias (e.g., "studio", "@lmthing/state", "core")
 * @returns Object with dependsOn and dependedBy arrays
 */

const dependencyGraph: Record<string, { dependsOn: string[]; dependedBy: string[] }> = {
  "lmthing": {
    dependsOn: ["Vercel AI SDK v6", "@lmthing/state (optional)"],
    dependedBy: ["studio", "chat", "computer", "space", "social", "team", "blog", "casa"],
  },
  "@lmthing/state": {
    dependsOn: [],
    dependedBy: ["studio", "chat", "computer", "space", "social", "team", "lmthing (optional)"],
  },
  "@lmthing/auth": {
    dependsOn: ["cloud/exchange-sso-code", "cloud/create-sso-code"],
    dependedBy: ["studio", "chat", "com", "computer", "space", "social", "team", "store", "blog", "casa"],
  },
  "@lmthing/ui": {
    dependsOn: ["@lmthing/css", "Radix UI"],
    dependedBy: ["studio", "chat", "com", "computer", "space", "social", "team", "store", "blog", "casa"],
  },
  "@lmthing/css": {
    dependsOn: ["Tailwind CSS v4"],
    dependedBy: ["@lmthing/ui", "studio", "chat", "com", "computer", "space", "social", "team", "store", "blog", "casa"],
  },
  "@lmthing/thing": {
    dependsOn: ["lmthing"],
    dependedBy: ["computer", "chat"],
  },
  "@lmthing/utils": {
    dependsOn: ["Vite 7"],
    dependedBy: ["studio", "chat", "com", "computer", "space", "social", "team", "store", "blog", "casa"],
  },
  "cloud": {
    dependsOn: ["Supabase", "Stripe SDK", "K8s API"],
    dependedBy: ["all frontend apps (via HTTP)"],
  },
  "studio": {
    dependsOn: ["@lmthing/ui", "@lmthing/css", "@lmthing/state", "@lmthing/auth", "lmthing", "@lmthing/utils"],
    dependedBy: [],
  },
  "com": {
    dependsOn: ["@lmthing/ui", "@lmthing/css", "@lmthing/auth", "@lmthing/utils", "Supabase Auth"],
    dependedBy: ["all apps (via SSO redirect)"],
  },
};

const aliases: Record<string, string> = {
  core: "lmthing",
  framework: "lmthing",
  agent: "lmthing",
  state: "@lmthing/state",
  vfs: "@lmthing/state",
  auth: "@lmthing/auth",
  ui: "@lmthing/ui",
  css: "@lmthing/css",
  thing: "@lmthing/thing",
  utils: "@lmthing/utils",
  backend: "cloud",
  edge: "cloud",
  supabase: "cloud",
  builder: "studio",
  landing: "com",
};

export function formatDependencyTree(packageName: string) {
  const resolved = aliases[packageName.toLowerCase()] || packageName;
  const deps = dependencyGraph[resolved];

  if (!deps) {
    return {
      error: `Unknown package "${packageName}". Known packages: ${Object.keys(dependencyGraph).join(", ")}`,
    };
  }

  return {
    package: resolved,
    dependsOn: deps.dependsOn,
    dependedBy: deps.dependedBy,
    impactLevel: deps.dependedBy.length > 5 ? "high" : deps.dependedBy.length > 2 ? "medium" : "low",
    warning: deps.dependedBy.length > 5
      ? `Changes to ${resolved} affect ${deps.dependedBy.length} consumers — test broadly`
      : undefined,
  };
}
