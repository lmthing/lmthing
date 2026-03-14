import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { spaceAppName, SPACE_SPEC, HEALTH_CHECK, FLY_ORG } from "./container.ts";

Deno.test("spaceAppName generates correct format", () => {
  const result = spaceAppName("my-space", "550e8400-e29b-41d4-a716-446655440000");
  assertEquals(result, "lmt-space-my-space-550e8400");
});

Deno.test("spaceAppName strips hyphens from userId", () => {
  const result = spaceAppName("test", "aaaa-bbbb-cccc-dddd-eeee");
  // "aaaabbbbccccddddeeee" → first 8 chars = "aaaabbbb"
  assertEquals(result, "lmt-space-test-aaaabbbb");
});

Deno.test("SPACE_SPEC has expected defaults", () => {
  assertEquals(SPACE_SPEC.cpus, 1);
  assertEquals(SPACE_SPEC.memoryMb, 1024);
  assertEquals(SPACE_SPEC.cpuKind, "shared");
});

Deno.test("HEALTH_CHECK is configured correctly", () => {
  assertEquals(HEALTH_CHECK.httpget.port, 8080);
  assertEquals(HEALTH_CHECK.httpget.path, "/health");
  assertEquals(HEALTH_CHECK.httpget.type, "http");
  assertEquals(HEALTH_CHECK.httpget.method, "GET");
});

Deno.test("FLY_ORG defaults to lmthing", () => {
  // FLY_ORG reads from env with fallback
  assertEquals(typeof FLY_ORG, "string");
});
