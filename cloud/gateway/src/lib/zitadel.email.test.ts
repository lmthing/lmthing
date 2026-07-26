import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Identity resolution for passwordless email sign-in.
 *
 * The two properties that matter are about NOT forking an account and NOT
 * inventing a credential: an address that already has a Zitadel user (from a
 * password registration, or created by the GitHub IDP link where the username is
 * the GitHub login and only the email matches) must resolve to that same user,
 * and a brand-new one must be created with no `password` field at all.
 */

process.env.ZITADEL_URL = "http://zitadel.test";
process.env.ZITADEL_SERVICE_PAT = "pat-test";
process.env.ZITADEL_CLIENT_ID = "cid";
process.env.ZITADEL_CLIENT_SECRET = "csecret";

const { findOrCreateUserByEmail, createPasswordlessUser } = await import("./zitadel.js");

interface Call {
  method: string;
  path: string;
  body: any;
}
let calls: Call[] = [];

/**
 * `searchResults` is consumed one entry per `POST /v2/users` search, so a test can
 * say "not found, then found" — which is exactly the create-race shape.
 */
function stubZitadel(opts: {
  searchResults: (string | null)[];
  createStatus?: number;
  createUserId?: string;
}) {
  const searches = [...opts.searchResults];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ method, path, body });

      if (path === "/v2/users" && method === "POST") {
        const found = searches.shift() ?? null;
        return new Response(
          JSON.stringify({ result: found ? [{ userId: found }] : [] }),
          { status: 200 },
        );
      }
      if (path === "/v2/users/human" && method === "POST") {
        const status = opts.createStatus ?? 200;
        if (status !== 200) {
          return new Response(JSON.stringify({ message: "User already exists" }), { status });
        }
        return new Response(JSON.stringify({ userId: opts.createUserId ?? "new-user" }), {
          status: 200,
        });
      }
      // GET /v2/users/{id}
      const id = path.replace("/v2/users/", "");
      return new Response(
        JSON.stringify({ user: { userId: id, human: { email: { email: "ada@example.com" } } } }),
        { status: 200 },
      );
    }),
  );
}

beforeEach(() => {
  calls = [];
  vi.unstubAllGlobals();
});

describe("findOrCreateUserByEmail", () => {
  it("returns the existing user and creates nothing", async () => {
    stubZitadel({ searchResults: ["existing-1"] });

    const user = await findOrCreateUserByEmail("ada@example.com");

    expect(user).toEqual({ id: "existing-1", email: "ada@example.com" });
    // No POST /v2/users/human — an address that already signed in with GitHub or
    // registered with a password must not get a second account.
    expect(calls.some((c) => c.path === "/v2/users/human")).toBe(false);
  });

  it("creates a user with NO password on first sign-in", async () => {
    stubZitadel({ searchResults: [null], createUserId: "created-1" });

    const user = await findOrCreateUserByEmail("new@example.com");

    expect(user).toEqual({ id: "created-1", email: "new@example.com" });
    const create = calls.find((c) => c.path === "/v2/users/human")!;
    expect(create.body).toEqual({
      username: "new@example.com",
      profile: { givenName: "User", familyName: "." },
      email: { email: "new@example.com", isVerified: true },
    });
    // A random password nobody knows is still a credential that can be reset or
    // brute-forced. Proof-of-mailbox has to be the only way in.
    expect(create.body).not.toHaveProperty("password");
  });

  it("resolves the winner when two first sign-ins race", async () => {
    // Both requests see "no such user"; one create wins, the loser 409s and has
    // to return the winner's user rather than failing the sign-in.
    stubZitadel({ searchResults: [null, "winner-1"], createStatus: 409 });

    const user = await findOrCreateUserByEmail("race@example.com");

    expect(user).toEqual({ id: "winner-1", email: "ada@example.com" });
    expect(calls.filter((c) => c.path === "/v2/users").length).toBe(2);
  });

  it("surfaces the create error when the retry lookup also finds nothing", async () => {
    stubZitadel({ searchResults: [null, null], createStatus: 400 });

    await expect(findOrCreateUserByEmail("broken@example.com")).rejects.toThrow(
      /User already exists/,
    );
  });
});

describe("createPasswordlessUser", () => {
  it("reports Zitadel's own message on failure", async () => {
    stubZitadel({ searchResults: [], createStatus: 400 });
    await expect(createPasswordlessUser("x@example.com")).rejects.toThrow(
      /User already exists/,
    );
  });
});
