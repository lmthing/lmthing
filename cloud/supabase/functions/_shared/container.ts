import {
  FlyioProvider,
  type ContainerProvider,
} from "../../../../org/libs/container/src/index.ts";

let _provider: ContainerProvider | null = null;

/** Default Fly.io org for space apps */
export const FLY_ORG = Deno.env.get("FLY_ORG") ?? "lmthing";

/** Default Docker image for space containers */
export const SPACE_IMAGE =
  Deno.env.get("SPACE_IMAGE") ?? "registry.fly.io/lmthing-space:latest";

/** Default machine spec for spaces */
export const SPACE_SPEC = {
  cpus: 1,
  memoryMb: 1024,
  cpuKind: "shared" as const,
};

/**
 * Get the shared ContainerProvider instance.
 * Uses Fly.io Machines API backed by FLY_API_TOKEN env var.
 */
export function getContainer(): ContainerProvider {
  if (!_provider) {
    const apiToken = Deno.env.get("FLY_API_TOKEN");
    if (!apiToken) {
      throw new Error("FLY_API_TOKEN environment variable is required");
    }
    _provider = new FlyioProvider({ apiToken });
  }
  return _provider;
}

/** Token secret injected into space containers for WebSocket auth */
export const SPACE_TOKEN_SECRET = Deno.env.get("SPACE_TOKEN_SECRET") ?? "";

/** Token secret injected into computer containers for WebSocket auth */
export const COMPUTER_TOKEN_SECRET = Deno.env.get("COMPUTER_TOKEN_SECRET") ?? "";

/** Generate a unique Fly app name for a space */
export function spaceAppName(slug: string, userId: string): string {
  const short = userId.replace(/-/g, "").slice(0, 8);
  return `lmt-space-${slug}-${short}`;
}
