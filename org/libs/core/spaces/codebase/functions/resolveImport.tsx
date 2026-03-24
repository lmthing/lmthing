/**
 * Resolves a @lmthing/* import alias or @/ path to its actual file path in the monorepo.
 *
 * @param alias - Import alias (e.g., "@lmthing/state", "@lmthing/ui", "@/components/Foo")
 * @returns Object with the alias, resolved path, and description
 */

const aliasMap: Record<string, { path: string; description: string }> = {
  "lmthing": {
    path: "org/libs/core/src",
    description: "Agent framework — StatefulPrompt, plugins, providers, CLI",
  },
  "@lmthing/state": {
    path: "org/libs/state/src",
    description: "Virtual file system — VFS, hooks, event bus, providers",
  },
  "@lmthing/auth": {
    path: "org/libs/auth/src",
    description: "Cross-domain SSO client — AuthProvider, useAuth",
  },
  "@lmthing/ui": {
    path: "org/libs/ui/src",
    description: "Shared React UI components — Radix + Tailwind",
  },
  "@lmthing/css": {
    path: "org/libs/css/src",
    description: "Shared Tailwind styles and design tokens",
  },
  "@lmthing/thing": {
    path: "org/libs/thing",
    description: "THING agent system studio — built-in spaces",
  },
  "@lmthing/utils": {
    path: "org/libs/utils/src",
    description: "Shared build utilities — Vite config",
  },
};

export function resolveImport(alias: string) {
  // Direct alias match
  const direct = aliasMap[alias];
  if (direct) {
    return { alias, resolvedPath: direct.path, description: direct.description };
  }

  // Partial match for subpath imports (e.g., "@lmthing/ui/components/Button")
  for (const [key, value] of Object.entries(aliasMap)) {
    if (alias.startsWith(key + "/")) {
      const subpath = alias.slice(key.length + 1);
      return {
        alias,
        resolvedPath: `${value.path}/${subpath}`,
        description: `${value.description} — subpath: ${subpath}`,
      };
    }
  }

  // @/ alias (app-local src/)
  if (alias.startsWith("@/")) {
    return {
      alias,
      resolvedPath: `<app>/src/${alias.slice(2)}`,
      description: "App-local import — resolves to src/ directory of the current app",
    };
  }

  return {
    error: `Unknown alias "${alias}". Known aliases: ${Object.keys(aliasMap).join(", ")}, @/`,
  };
}
