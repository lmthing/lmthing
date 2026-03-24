/**
 * Finds a package in the lmthing monorepo by name or keyword.
 *
 * @param query - Package name, alias, or keyword to search for
 * @returns Object with package name, path, description, and key files
 */

const packages = [
  {
    name: "lmthing",
    aliases: ["core", "agent", "framework"],
    path: "org/libs/core/",
    description: "Agentic framework — StatefulPrompt, plugins, multi-provider, CLI",
    keyFiles: ["src/stateful-prompt.ts", "src/plugins/", "src/providers/", "src/cli/"],
  },
  {
    name: "@lmthing/state",
    aliases: ["state", "vfs", "filesystem"],
    path: "org/libs/state/",
    description: "Virtual file system — Map-based VFS, FSEventBus, React hooks",
    keyFiles: ["src/fs.ts", "src/event-bus.ts", "src/providers/", "src/hooks/"],
  },
  {
    name: "@lmthing/auth",
    aliases: ["auth", "sso", "login"],
    path: "org/libs/auth/",
    description: "Cross-domain SSO client — AuthProvider, useAuth hook",
    keyFiles: ["src/provider.tsx", "src/hooks.ts", "src/sso.ts"],
  },
  {
    name: "@lmthing/ui",
    aliases: ["ui", "components", "radix"],
    path: "org/libs/ui/",
    description: "Shared React UI components — Radix UI + Tailwind",
    keyFiles: ["src/components/", "src/index.ts"],
  },
  {
    name: "@lmthing/css",
    aliases: ["css", "styles", "tailwind", "tokens"],
    path: "org/libs/css/",
    description: "Shared Tailwind styles and design tokens",
    keyFiles: ["src/global.css", "src/tokens.ts"],
  },
  {
    name: "@lmthing/thing",
    aliases: ["thing", "spaces", "built-in"],
    path: "org/libs/thing/",
    description: "THING agent system studio — 7 built-in spaces, 12 agents, 12 flows",
    keyFiles: ["spaces/"],
  },
  {
    name: "@lmthing/utils",
    aliases: ["utils", "vite", "build"],
    path: "org/libs/utils/",
    description: "Shared build utilities — Vite config with workspace alias resolution",
    keyFiles: ["src/vite.mjs"],
  },
  {
    name: "cloud",
    aliases: ["backend", "edge", "supabase", "api"],
    path: "cloud/",
    description: "Supabase Edge Functions — sole backend for all products",
    keyFiles: ["supabase/export functions/", "supabase/functions/_shared/"],
  },
  {
    name: "studio",
    aliases: ["builder", "editor", "workspace"],
    path: "studio/",
    description: "Agent builder UI — primary development surface",
    keyFiles: ["src/routes/", "src/components/"],
  },
  {
    name: "chat",
    aliases: ["conversation", "personal"],
    path: "chat/",
    description: "Personal THING interface",
    keyFiles: ["src/routes/", "src/components/"],
  },
  {
    name: "com",
    aliases: ["landing", "auth-hub", "onboarding"],
    path: "com/",
    description: "Commercial landing + central auth hub — GitHub OAuth, SSO",
    keyFiles: ["src/routes/", "src/auth/"],
  },
  {
    name: "computer",
    aliases: ["runtime", "terminal", "pod"],
    path: "computer/",
    description: "THING agent runtime — dedicated K8s compute pod + terminal access",
    keyFiles: ["src/routes/", "src/terminal/"],
  },
  {
    name: "space",
    aliases: ["deploy", "publish"],
    path: "space/",
    description: "Deploy spaces & publish agents",
    keyFiles: ["src/routes/"],
  },
];

export function findPackage(query: string) {
  const q = query.toLowerCase();
  const exact = packages.find(
    (p) => p.name.toLowerCase() === q || p.aliases.includes(q)
  );
  if (exact) return exact;

  const partial = packages.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.aliases.some((a) => a.includes(q)) ||
      p.description.toLowerCase().includes(q)
  );

  if (partial.length === 1) return partial[0];
  if (partial.length > 1)
    return {
      matches: partial.map((p) => ({
        name: p.name,
        path: p.path,
        description: p.description,
      })),
    };

  return { error: `No package found matching "${query}"` };
}
