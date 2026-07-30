import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";

/**
 * Passwordless email sign-in. The properties worth pinning down are all about
 * what must NOT be possible: a code must not survive being used, a wrong guess
 * must not be free, a magic link must not carry a token pair to a host we don't
 * control, and a deployment with no mailer must not answer "sent".
 *
 * The database is faked in-memory rather than mocked call-by-call, because the
 * single-use and attempt-cap guarantees live in SQL predicates
 * (`WHERE consumed_at IS NULL`) — a `vi.fn()` returning a canned row would
 * assert the handler calls a function, not that the guarantee holds.
 */

process.env.BASE_URL = "https://gw.test";

interface Row {
  id: string;
  email: string;
  code_hash: string;
  link_hash: string;
  redirect_uri: string | null;
  origin_hash: string | null;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

let rows: Row[] = [];
let nextId = 1;
/** Set to simulate a Postgres outage. */
let dbDown = false;

const live = (r: Row) => !r.consumed_at && new Date(r.expires_at) > new Date();

const fakeDb = {
  insertEmailLoginCode: vi.fn(
    async (input: {
      email: string;
      codeHash: string;
      linkHash: string;
      redirectUri: string | null;
      originHash: string | null;
      expiresAt: Date;
    }) => {
      if (dbDown) throw new Error("db down");
      // Supersede: the same UPDATE the real implementation runs in its tx.
      for (const r of rows) {
        if (r.email === input.email && !r.consumed_at) r.consumed_at = new Date().toISOString();
      }
      rows.push({
        id: `row-${nextId++}`,
        email: input.email,
        code_hash: input.codeHash,
        link_hash: input.linkHash,
        redirect_uri: input.redirectUri,
        origin_hash: input.originHash,
        attempts: 0,
        expires_at: input.expiresAt.toISOString(),
        consumed_at: null,
        created_at: new Date().toISOString(),
      });
    },
  ),
  countRecentEmailLoginCodes: vi.fn(async (email: string, since: Date) => {
    if (dbDown) throw new Error("db down");
    return rows.filter((r) => r.email === email && new Date(r.created_at) > since).length;
  }),
  findLiveEmailLoginCode: vi.fn(async (email: string) => {
    const matches = rows.filter((r) => r.email === email && live(r));
    return matches[matches.length - 1] ?? null;
  }),
  findLiveEmailLoginCodeByLink: vi.fn(async (linkHash: string) => {
    return rows.find((r) => r.link_hash === linkHash && live(r)) ?? null;
  }),
  consumeEmailLoginCode: vi.fn(async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row || !live(row)) return false;
    row.consumed_at = new Date().toISOString();
    return true;
  }),
  recordEmailLoginAttempt: vi.fn(async (id: string, maxAttempts: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return maxAttempts;
    row.attempts += 1;
    if (row.attempts >= maxAttempts) row.consumed_at = new Date().toISOString();
    return row.attempts;
  }),
  purgeExpiredEmailLoginCodes: vi.fn(async () => undefined),
};

vi.mock("../lib/db.js", () => fakeDb);
vi.mock("../lib/stripe.js", () => ({ stripe: { customers: { create: vi.fn() } } }));
// A user that already exists in LiteLLM makes provisionUser a no-op read, which
// is the steady state for every sign-in after the first.
vi.mock("../lib/litellm.js", () => ({
  getUserInfo: vi.fn(async () => ({ user_info: { metadata: { tier: "free" } } })),
  listKeys: vi.fn(async () => [{ token: "sk-test" }]),
  createUser: vi.fn(),
  generateKey: vi.fn(),
}));
vi.mock("../lib/zitadel.js", () => ({
  findOrCreateUserByEmail: vi.fn(async (email: string) => ({ id: "user-1", email })),
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  loginWithPassword: vi.fn(),
  startIdpIntent: vi.fn(),
  resolveIdpIntent: vi.fn(),
}));
vi.mock("../lib/email.js", () => ({
  isEmailConfigured: vi.fn(() => true),
  sendEmail: vi.fn(async () => undefined),
}));

const email = await import("../lib/email.js");
const zitadel = await import("../lib/zitadel.js");
const { verifyAccessToken } = await import("../lib/tokens.js");
const { default: authRouter } = await import("./auth.js");

const app = new Hono().route("/api/auth", authRouter);

/**
 * Each test gets its own client IP: the per-IP limiter is a module-level map that
 * outlives a single test, so sharing an IP would make later tests fail on the
 * limiter rather than on what they are checking.
 */
let ipCounter = 0;
function nextIp(): string {
  return `10.0.0.${++ipCounter}`;
}

function start(
  body: Record<string, unknown>,
  ip = nextIp(),
): Promise<Response> {
  return app.request("/api/auth/email/start", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function verify(body: Record<string, unknown>, ip = nextIp()): Promise<Response> {
  return app.request("/api/auth/email/verify", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

/** The code that was mailed — read off the send spy, never out of the response. */
function mailedCode(): string {
  const calls = vi.mocked(email.sendEmail).mock.calls;
  const last = calls[calls.length - 1]![0];
  const m = last.text.match(/(\d{3}) (\d{3})/);
  if (!m) throw new Error(`no code in mail body: ${last.text}`);
  return `${m[1]}${m[2]}`;
}

/**
 * The `__Host-` cookie naming the browser that asked, as a `Cookie` header value.
 *
 * Replaying it on the callback is what makes a click "the same device"; omitting it
 * is what makes it "some other device". Every same-device assertion below therefore
 * has to thread this through, exactly as a real browser would.
 */
function originCookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("no Set-Cookie on the start response");
  return setCookie.split(";")[0]!;
}

/** Click the magic link, optionally as the browser that requested it. */
function clickLink(link: string, cookie?: string): Promise<Response> {
  const url = new URL(link);
  return app.request(url.pathname + url.search, {
    headers: cookie ? { cookie } : {},
  });
}

function mailedLink(): string {
  const calls = vi.mocked(email.sendEmail).mock.calls;
  const last = calls[calls.length - 1]![0];
  const m = last.text.match(/https:\/\/\S+/);
  if (!m) throw new Error(`no link in mail body: ${last.text}`);
  return m[0];
}

beforeEach(() => {
  rows = [];
  nextId = 1;
  dbDown = false;
  vi.clearAllMocks();
  vi.mocked(email.isEmailConfigured).mockReturnValue(true);
  vi.mocked(email.sendEmail).mockResolvedValue(undefined);
  vi.mocked(zitadel.findOrCreateUserByEmail).mockImplementation(
    async (addr: string) => ({ id: "user-1", email: addr }),
  );
  delete process.env.EMAIL_DEV_ECHO;
  delete process.env.LOCAL_DEV;
  delete process.env.EMAIL_LOGIN_ALLOWED_ORIGINS;
});

describe("POST /email/start", () => {
  it("mails a code + link to any address and reveals neither in the response", async () => {
    const res = await start({ email: "someone@some-random-domain.example" });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.sent).toBe(true);
    // The masked address is safe to echo; the credentials are not — an attacker
    // who can POST /email/start for a victim's mailbox must learn nothing.
    expect(body.email).toBe("s••••@some-random-domain.example");
    expect(JSON.stringify(body)).not.toContain(mailedCode());
    expect(body.dev_code).toBeUndefined();
    expect(body.dev_link).toBeUndefined();

    expect(vi.mocked(email.sendEmail)).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(email.sendEmail).mock.calls[0]![0];
    expect(sent.to).toBe("someone@some-random-domain.example");
    expect(sent.subject).toContain(mailedCode().slice(0, 3));
  });

  it("stores only hashes — the row never holds the code or the link token", async () => {
    await start({ email: "hash@example.com" });
    const code = mailedCode();
    const token = new URL(mailedLink()).searchParams.get("token")!;

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.code_hash).not.toContain(code);
    expect(row.link_hash).not.toContain(token);
    expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.link_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("treats a differently-cased address as the same mailbox", async () => {
    await start({ email: "  Ada@Example.COM " });
    expect(vi.mocked(email.sendEmail).mock.calls[0]![0].to).toBe("ada@example.com");
    expect(rows[0]!.email).toBe("ada@example.com");
  });

  it("rejects something that cannot be an address", async () => {
    for (const bad of ["", "nope", "a@b", "a b@c.com", "@example.com", 42, null]) {
      const res = await start({ email: bad });
      expect(res.status, `for ${JSON.stringify(bad)}`).toBe(400);
    }
    expect(vi.mocked(email.sendEmail)).not.toHaveBeenCalled();
  });

  it("supersedes the previous code so only the newest one works", async () => {
    const ip = nextIp();
    await start({ email: "resend@example.com" }, ip);
    const first = mailedCode();
    await start({ email: "resend@example.com" }, ip);
    const second = mailedCode();
    expect(second).not.toBe(first);

    expect((await verify({ email: "resend@example.com", code: first })).status).toBe(401);
    expect((await verify({ email: "resend@example.com", code: second })).status).toBe(200);
  });

  it("throttles per mailbox, even from fresh IPs", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await start({ email: "spammed@example.com" })).status).toBe(200);
    }
    const res = await start({ email: "spammed@example.com" });
    expect(res.status).toBe(429);
    // The 6th send must not have gone out.
    expect(vi.mocked(email.sendEmail)).toHaveBeenCalledTimes(5);
  });

  it("throttles per IP across different mailboxes", async () => {
    const ip = nextIp();
    for (let i = 0; i < 10; i++) {
      expect((await start({ email: `user${i}@example.com` }, ip)).status).toBe(200);
    }
    const res = await start({ email: "user10@example.com" }, ip);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("refuses a redirect_uri we do not control", async () => {
    for (const bad of [
      "https://evil.example.com/callback",
      "https://lmthing.com.evil.example/callback",
      "javascript:alert(1)",
      "http://lmthing.com/callback",
      "not a url",
    ]) {
      const res = await start({ email: "redir@example.com", redirect_uri: bad });
      expect(res.status, `for ${bad}`).toBe(400);
    }
    expect(vi.mocked(email.sendEmail)).not.toHaveBeenCalled();
  });

  it("accepts an lmthing origin and honours an explicit allowlist", async () => {
    expect(
      (await start({ email: "ok@example.com", redirect_uri: "https://lmthing.com/callback" }))
        .status,
    ).toBe(200);

    process.env.EMAIL_LOGIN_ALLOWED_ORIGINS = "https://only.example.com";
    expect(
      (await start({ email: "ok2@example.com", redirect_uri: "https://lmthing.com/callback" }))
        .status,
    ).toBe(400);
    expect(
      (await start({ email: "ok3@example.com", redirect_uri: "https://only.example.com/cb" }))
        .status,
    ).toBe(200);
  });

  it("refuses to claim it sent mail when no transport is configured", async () => {
    vi.mocked(email.isEmailConfigured).mockReturnValue(false);
    const res = await start({ email: "nomailer@example.com" });
    expect(res.status).toBe(503);
    expect(vi.mocked(email.sendEmail)).not.toHaveBeenCalled();
    // Nothing was issued, so nothing is guessable.
    expect(rows).toHaveLength(0);
  });

  it("echoes the credentials only when EMAIL_DEV_ECHO opts in without a transport", async () => {
    vi.mocked(email.isEmailConfigured).mockReturnValue(false);
    process.env.EMAIL_DEV_ECHO = "true";
    const res = await start({ email: "dev@example.com" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dev_code).toMatch(/^\d{6}$/);
    expect(body.dev_link).toContain("https://gw.test/api/auth/email/callback?token=");

    // With a real transport the echo is off even if the flag is set — otherwise
    // production would leak codes to anyone who can POST for an address.
    vi.mocked(email.isEmailConfigured).mockReturnValue(true);
    const real = await (await start({ email: "dev2@example.com" })).json();
    expect(real.dev_code).toBeUndefined();
    expect(real.dev_link).toBeUndefined();
  });

  it("surfaces a delivery failure instead of leaving the user waiting", async () => {
    vi.mocked(email.sendEmail).mockRejectedValue(
      new Error("535 auth failed for smtp-user@relay.internal"),
    );
    const res = await start({ email: "bounce@example.com" });
    expect(res.status).toBe(502);
    // The relay's error text can name the host and account — it must not travel.
    expect(JSON.stringify(await res.json())).not.toContain("relay.internal");
  });

  it("does not mail anything when the database is unavailable", async () => {
    dbDown = true;
    const res = await start({ email: "dberr@example.com" });
    expect(res.status).toBe(503);
    expect(vi.mocked(email.sendEmail)).not.toHaveBeenCalled();
  });
});

describe("POST /email/verify", () => {
  async function issue(addr = "user@example.com") {
    await start({ email: addr });
    return mailedCode();
  }

  it("exchanges a correct code for a usable gateway session", async () => {
    const code = await issue();
    const res = await verify({ email: "user@example.com", code });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(await verifyAccessToken(body.access_token)).toEqual({
      userId: "user-1",
      email: "user@example.com",
    });
    expect(body.refresh_token).toBeTruthy();
    expect(body.user).toEqual({ id: "user-1", email: "user@example.com" });
  });

  it("accepts a code the user typed with a space in it", async () => {
    const code = await issue();
    const res = await verify({
      email: "user@example.com",
      code: `${code.slice(0, 3)} ${code.slice(3)}`,
    });
    expect(res.status).toBe(200);
  });

  it("creates the account on first sign-in and reuses it afterwards", async () => {
    const code = await issue("brand-new@example.com");
    await verify({ email: "brand-new@example.com", code });
    expect(vi.mocked(zitadel.findOrCreateUserByEmail)).toHaveBeenCalledWith(
      "brand-new@example.com",
    );
  });

  it("burns the code — a replay of the same correct code fails", async () => {
    const code = await issue();
    expect((await verify({ email: "user@example.com", code })).status).toBe(200);
    const replay = await verify({ email: "user@example.com", code });
    expect(replay.status).toBe(401);
  });

  it("stops guessing after 5 wrong codes, even though the code is still unexpired", async () => {
    const code = await issue();
    const wrong = code === "000000" ? "111111" : "000000";

    for (let i = 1; i <= 4; i++) {
      const res = await verify({ email: "user@example.com", code: wrong });
      expect(res.status).toBe(401);
      expect((await res.json()).attempts_remaining).toBe(5 - i);
    }
    const last = await verify({ email: "user@example.com", code: wrong });
    expect((await last.json()).attempts_remaining).toBe(0);

    // The row is spent: the RIGHT code no longer works either.
    expect((await verify({ email: "user@example.com", code })).status).toBe(401);
  });

  it("will not verify a code against a different mailbox", async () => {
    const code = await issue("owner@example.com");
    await start({ email: "attacker@example.com" });
    const res = await verify({ email: "attacker@example.com", code });
    expect(res.status).toBe(401);
  });

  it("rejects an expired code", async () => {
    await issue();
    rows[0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    const res = await verify({ email: "user@example.com", code: mailedCode() });
    expect(res.status).toBe(401);
  });

  it("rejects a malformed submission without touching the row", async () => {
    await issue();
    for (const bad of ["12345", "abcdef", "", null]) {
      expect((await verify({ email: "user@example.com", code: bad })).status).toBe(400);
    }
    expect(rows[0]!.attempts).toBe(0);
  });

  it("401s when there is no code for the address at all", async () => {
    const res = await verify({ email: "never-asked@example.com", code: "123456" });
    expect(res.status).toBe(401);
  });
});

describe("GET /email/callback (magic link)", () => {
  it("redirects to the recorded redirect_uri with tokens in the fragment", async () => {
    const started = await start({
      email: "link@example.com",
      redirect_uri: "https://lmthing.com/callback?next=%2Fauth%2Fsso",
    });
    const res = await clickLink(mailedLink(), originCookieFrom(started));

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://lmthing.com/callback");
    // The app-level destination survives — the fragment is appended, the query
    // is not replaced.
    expect(location.searchParams.get("next")).toBe("/auth/sso");

    const frag = new URLSearchParams(location.hash.slice(1));
    expect(await verifyAccessToken(frag.get("access_token")!)).toEqual({
      userId: "user-1",
      email: "link@example.com",
    });
    expect(frag.get("refresh_token")).toBeTruthy();
    expect(Number(frag.get("expires_at"))).toBeGreaterThan(Date.now() / 1000);
  });

  it("returns the session as JSON when no redirect was requested", async () => {
    const started = await start({ email: "api@example.com" });
    const res = await clickLink(mailedLink(), originCookieFrom(started));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(await verifyAccessToken(body.access_token)).toEqual({
      userId: "user-1",
      email: "api@example.com",
    });
  });

  it("is single-use — the second click fails", async () => {
    const started = await start({ email: "once@example.com" });
    const cookie = originCookieFrom(started);
    expect((await clickLink(mailedLink(), cookie)).status).toBe(200);
    expect((await clickLink(mailedLink(), cookie)).status).toBe(401);
  });

  it("invalidates the typed code too — the row is the single-use unit", async () => {
    const started = await start({ email: "both@example.com" });
    const code = mailedCode();
    expect((await clickLink(mailedLink(), originCookieFrom(started))).status).toBe(200);
    expect((await verify({ email: "both@example.com", code })).status).toBe(401);
  });

  // ── opened somewhere else ──────────────────────────────────────────────────
  //
  // The case the link exists for — mail read on a phone while the laptop waits —
  // and the case that used to hand the session to the wrong device.

  it("does NOT sign in a device that did not ask — it explains instead", async () => {
    await start({ email: "elsewhere@example.com", redirect_uri: "https://lmthing.com/callback" });

    const res = await clickLink(mailedLink()); // no cookie: a different browser
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const body = await res.text();
    expect(body).toContain("finish on the other device");
    // The whole point: no credential is handed over here.
    expect(body).not.toContain("access_token");
    expect(res.headers.get("location")).toBeNull();
  });

  it("leaves the row spendable, so the waiting device can still finish", async () => {
    await start({ email: "waiting@example.com" });
    const code = mailedCode();

    await clickLink(mailedLink()); // read on a phone…

    // …and the laptop that asked types the code from that same mail. It still works,
    // which is why nothing has to be regenerated or shown on the phone.
    const res = await verify({ email: "waiting@example.com", code });
    expect(res.status).toBe(200);
    expect(await verifyAccessToken((await res.json()).access_token)).toEqual({
      userId: "user-1",
      email: "waiting@example.com",
    });
  });

  it("rejects a cookie from a DIFFERENT sign-in, not just a missing one", async () => {
    // Otherwise any stale cookie would pass: the binding has to be per-row.
    const other = await start({ email: "other@example.com" });
    await start({ email: "victim@example.com", redirect_uri: "https://lmthing.com/callback" });

    const res = await clickLink(mailedLink(), originCookieFrom(other));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("location")).toBeNull();
  });

  it("a forwarded link cannot be spent by the recipient", async () => {
    // The security half of the same rule: possession of the link is no longer
    // possession of the account.
    const started = await start({ email: "forwarded@example.com" });
    expect((await clickLink(mailedLink())).status).toBe(200); // attacker: instructions only

    // And the rightful owner's own click still completes.
    expect((await clickLink(mailedLink(), originCookieFrom(started))).status).toBe(200);
  });

  it("rejects a missing, unknown or expired token", async () => {
    expect((await app.request("/api/auth/email/callback")).status).toBe(400);
    expect(
      (await app.request("/api/auth/email/callback?token=not-a-real-token")).status,
    ).toBe(401);

    await start({ email: "stale@example.com" });
    rows[0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    const link = new URL(mailedLink());
    expect((await app.request(link.pathname + link.search)).status).toBe(401);
  });
});
