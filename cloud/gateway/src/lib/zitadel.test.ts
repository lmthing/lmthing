import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Zitadel's v2 user search is the only way the gateway learns whether an email
 * already has an account. Getting the filter's field name wrong is a SILENT
 * failure: Zitadel ignores an unknown query field, answers 200, and returns an
 * empty result — indistinguishable from "no such user".
 *
 * That mattered twice. Adding a teammate by email seated everyone as a pending
 * invite instead of a member, and the GitHub sign-in path that links an IDP to
 * a pre-existing email could never find the email to link to.
 */

process.env.ZITADEL_URL = "http://zitadel.test";
process.env.ZITADEL_SERVICE_PAT = "pat-test";
process.env.ZITADEL_CLIENT_ID = "cid";
process.env.ZITADEL_CLIENT_SECRET = "csecret";

const { getUserByEmail } = await import("./zitadel.js");

interface Call {
  path: string;
  body: any;
}
let calls: Call[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: any) => {
      const path = String(url).replace("http://zitadel.test", "");
      calls.push({ path, body: init?.body ? JSON.parse(init.body) : undefined });

      // The search answers only when asked with the field name Zitadel accepts.
      if (path === "/v2/users") {
        const q = init && JSON.parse(init.body)?.queries?.[0]?.emailQuery;
        const found = q?.emailAddress === "someone@example.com";
        return new Response(JSON.stringify(found ? { result: [{ userId: "u-1" }] } : {}), {
          status: 200,
        });
      }
      if (path === "/v2/users/u-1") {
        return new Response(
          JSON.stringify({ user: { userId: "u-1", human: { email: { email: "someone@example.com" } } } }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

describe("getUserByEmail", () => {
  it("filters on emailAddress — the field the v2 API actually reads", async () => {
    await getUserByEmail("someone@example.com");
    const search = calls.find((c) => c.path === "/v2/users");
    expect(search?.body.queries[0].emailQuery).toEqual({
      emailAddress: "someone@example.com",
      method: "TEXT_QUERY_METHOD_EQUALS",
    });
  });

  it("resolves an existing account to its user id", async () => {
    await expect(getUserByEmail("someone@example.com")).resolves.toMatchObject({ id: "u-1" });
  });

  it("rejects when nothing matches, so callers can treat it as 'no account'", async () => {
    await expect(getUserByEmail("nobody@example.com")).rejects.toThrow(/not found/i);
  });
});
