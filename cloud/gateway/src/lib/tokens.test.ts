import { describe, it, expect } from "vitest";
import {
  signTokens,
  signTeamToken,
  verifyTeamToken,
  verifyAccessToken,
  signComputeToken,
  verifyComputeToken,
} from "./tokens.js";

describe("team tokens", () => {
  it("round-trips the member, team and role", async () => {
    const { access_token, expires_at } = await signTeamToken(
      "user-1",
      "a@example.com",
      "team-uuid",
      "editor",
    );
    const claims = await verifyTeamToken(access_token);
    expect(claims).toEqual({
      userId: "user-1",
      email: "a@example.com",
      teamId: "team-uuid",
      role: "editor",
    });
    // ~1h TTL, so a browser re-mints often enough for role changes to land.
    const ttl = expires_at - Math.floor(Date.now() / 1000);
    expect(ttl).toBeGreaterThan(3500);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it("rejects a personal access token — it carries no team claim", async () => {
    const { access_token } = await signTokens("user-1", "a@example.com");
    expect(await verifyTeamToken(access_token)).toBeNull();
  });

  it("rejects a token whose role claim is not a known role", async () => {
    // Reach through signTeamToken's typing to prove verification, not TS, is
    // what rejects an unknown role.
    const sign = signTeamToken as unknown as (
      u: string,
      e: string,
      t: string,
      r: string,
    ) => Promise<{ access_token: string }>;
    const { access_token } = await sign("u", "e@x.com", "t", "admin");
    expect(await verifyTeamToken(access_token)).toBeNull();
  });

  it("rejects a compute token (different audience, no team claim)", async () => {
    const token = await signComputeToken("user-1");
    expect(await verifyTeamToken(token)).toBeNull();
    expect(await verifyComputeToken(token)).toEqual({ userId: "user-1" });
  });

  it("also satisfies verifyAccessToken as the same user — documented and harmless", async () => {
    const { access_token } = await signTeamToken(
      "user-1",
      "a@example.com",
      "team-uuid",
      "viewer",
    );
    // It grants the member their own identity, which they already hold; it can
    // never impersonate anyone else because `sub` is the member.
    expect(await verifyAccessToken(access_token)).toEqual({
      userId: "user-1",
      email: "a@example.com",
    });
  });

  it("rejects a token signed with a different secret", async () => {
    // A JWT minted elsewhere must not pass — Envoy validates against the same
    // shared secret, so this is the property the whole edge trusts.
    const { SignJWT } = await import("jose");
    const forged = await new SignJWT({
      email: "a@example.com",
      team: "team-uuid",
      role: "editor",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(Buffer.from("some-other-secret"));
    expect(await verifyTeamToken(forged)).toBeNull();
  });
});
