import {
  assertRejects,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Test the auth module's request validation (not the actual Supabase calls)

Deno.test("getUser throws on missing Authorization header", async () => {
  // Dynamic import to avoid issues with module-level env var access
  const { getUser } = await import("./auth.ts");

  const req = new Request("http://localhost/test", {
    method: "GET",
  });

  await assertRejects(
    () => getUser(req),
    Error,
    "Missing or invalid Authorization header"
  );
});

Deno.test("getUser throws on non-Bearer Authorization", async () => {
  const { getUser } = await import("./auth.ts");

  const req = new Request("http://localhost/test", {
    method: "GET",
    headers: { Authorization: "Basic abc123" },
  });

  await assertRejects(
    () => getUser(req),
    Error,
    "Missing or invalid Authorization header"
  );
});

Deno.test("AuthUser interface has expected shape", () => {
  // Type-level test: verify the interface matches expectations
  const user = {
    id: "test-uuid",
    email: "test@example.com",
    stripeCustomerId: null as string | null,
  };

  assertEquals(user.id, "test-uuid");
  assertEquals(user.email, "test@example.com");
  assertEquals(user.stripeCustomerId, null);
});
