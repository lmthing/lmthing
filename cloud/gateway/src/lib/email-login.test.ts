import { describe, it, expect } from "vitest";
import {
  CODE_TTL_MS,
  ORIGIN_COOKIE,
  generateOriginToken,
  hashOriginToken,
  originCookie,
  readOriginCookie,
  generateLinkToken,
  generateOtp,
  hashCode,
  hashLinkToken,
  hashesEqual,
  isAllowedRedirect,
  isReviewDemoLogin,
  maskEmail,
  normalizeEmail,
  normalizeOtp,
  redirectWithTokens,
  renderLoginEmail,
} from "./email-login.js";

describe("normalizeEmail", () => {
  it("accepts anything that can be a mailbox — the requirement is any email", () => {
    const cases: [string, string][] = [
      ["ada@example.com", "ada@example.com"],
      ["  Ada@Example.COM  ", "ada@example.com"],
      ["a.b+tag@sub.domain.co.uk", "a.b+tag@sub.domain.co.uk"],
      ["ünïcode@exämple.de", "ünïcode@exämple.de"],
      ["user_name-1@a-b.io", "user_name-1@a-b.io"],
      ["x@y.zz", "x@y.zz"],
    ];
    for (const [input, expected] of cases) {
      expect(normalizeEmail(input), input).toBe(expected);
    }
  });

  it("rejects only what cannot be a mailbox", () => {
    const bad = [
      "",
      "   ",
      "nope",
      "a@b", // no dot in the domain
      "a@b.", // empty label
      "a b@c.com", // whitespace
      "a@b c.com",
      "@example.com",
      "ada@",
      "two@at@example.com",
      "ada@example.com, evil@example.com", // header injection shape
      "ada@example.com>",
      "ada\n@example.com",
      `${"a".repeat(250)}@example.com`,
      42,
      null,
      undefined,
      {},
    ];
    for (const input of bad) {
      expect(normalizeEmail(input), JSON.stringify(input)).toBeNull();
    }
  });
});

describe("maskEmail", () => {
  it("keeps the domain and one character, so a user recognises their address", () => {
    expect(maskEmail("ada@example.com")).toBe("a••@example.com");
    expect(maskEmail("a@example.com")).toBe("a•••@example.com");
    expect(maskEmail("averylonglocalpart@example.com")).toBe("a••••@example.com");
  });
});

describe("generateOtp", () => {
  it("is always six digits, including leading zeros", () => {
    for (let i = 0; i < 500; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it("spans the whole space rather than a biased slice", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(generateOtp());
    // 2000 draws from 10^6 collide rarely; a generator stuck in a narrow range
    // would show up as a much smaller set.
    expect(seen.size).toBeGreaterThan(1900);
  });
});

describe("normalizeOtp", () => {
  it("takes what a user actually types", () => {
    expect(normalizeOtp("123456")).toBe("123456");
    expect(normalizeOtp(" 123 456 ")).toBe("123456");
    expect(normalizeOtp("123-456")).toBe("123456");
  });

  it("rejects the wrong length or a non-string", () => {
    for (const bad of ["12345", "1234567", "abcdef", "", 123456, null]) {
      expect(normalizeOtp(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("hashing", () => {
  it("binds a code hash to its mailbox", () => {
    // The OTP space is 10^6, so a code that verified against any row would be
    // brute-forceable across accounts. Same code + different email must differ.
    expect(hashCode("a@example.com", "123456")).not.toBe(
      hashCode("b@example.com", "123456"),
    );
    expect(hashCode("a@example.com", "123456")).toBe(hashCode("a@example.com", "123456"));
  });

  it("produces a digest that contains neither the code nor the token", () => {
    expect(hashCode("a@example.com", "123456")).toMatch(/^[0-9a-f]{64}$/);
    const token = generateLinkToken();
    const digest = hashLinkToken(token);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(token);
  });

  it("generates link tokens with 256 bits of entropy, URL-safe", () => {
    const token = generateLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(encodeURIComponent(token)).toBe(token);
  });

  it("compares digests without throwing on a length mismatch", () => {
    const a = hashCode("a@example.com", "123456");
    expect(hashesEqual(a, a)).toBe(true);
    expect(hashesEqual(a, hashCode("a@example.com", "654321"))).toBe(false);
    // timingSafeEqual throws on unequal lengths — the guard must come first.
    expect(hashesEqual(a, "short")).toBe(false);
    expect(hashesEqual("", a)).toBe(false);
  });
});

describe("isAllowedRedirect", () => {
  it("allows https lmthing hosts and local dev", () => {
    for (const ok of [
      "https://lmthing.com/callback",
      "https://lmthing.cloud/callback",
      "https://chat.lmthing.org/callback?next=/x",
      "http://localhost:3002/callback",
      "http://127.0.0.1:5173/callback",
      "http://com.test/callback",
    ]) {
      expect(isAllowedRedirect(ok), ok).toBe(true);
    }
  });

  it("rejects a host that merely looks like ours", () => {
    for (const bad of [
      "https://evil.example.com/callback",
      "https://lmthing.com.evil.example/callback",
      "https://evil-lmthing.com/callback",
      "https://lmthing.com@evil.example/callback",
      "http://lmthing.com/callback", // plaintext: the fragment carries tokens
      "javascript:alert(1)",
      "data:text/html,<script>",
      "//lmthing.com/callback",
      "not a url",
      "",
    ]) {
      expect(isAllowedRedirect(bad), bad).toBe(false);
    }
  });

  it("lets an explicit allowlist replace the defaults entirely", () => {
    const allow = "https://app.acme.test, https://other.acme.test";
    expect(isAllowedRedirect("https://app.acme.test/cb", allow)).toBe(true);
    expect(isAllowedRedirect("https://other.acme.test/cb", allow)).toBe(true);
    // Including our own hosts, which is the point of an override.
    expect(isAllowedRedirect("https://lmthing.com/callback", allow)).toBe(false);
    expect(isAllowedRedirect("https://sub.app.acme.test/cb", allow)).toBe(false);
  });
});

describe("redirectWithTokens", () => {
  const tokens = { access_token: "at", refresh_token: "rt", expires_at: 1234 };

  it("appends the fragment without disturbing the query", () => {
    const out = redirectWithTokens("https://lmthing.com/callback?next=%2Fauth%2Fsso", tokens);
    const url = new URL(out);
    expect(url.searchParams.get("next")).toBe("/auth/sso");
    const frag = new URLSearchParams(url.hash.slice(1));
    expect(frag.get("access_token")).toBe("at");
    expect(frag.get("refresh_token")).toBe("rt");
    expect(frag.get("expires_at")).toBe("1234");
  });

  it("replaces an existing fragment rather than nesting one", () => {
    const out = redirectWithTokens("https://lmthing.com/callback#stale=1", tokens);
    expect(out.match(/#/g)).toHaveLength(1);
    expect(out).not.toContain("stale");
  });
});

describe("renderLoginEmail", () => {
  const rendered = renderLoginEmail({
    code: "004821",
    link: "https://gw.test/api/auth/email/callback?token=abc&x=1",
    ttlMinutes: CODE_TTL_MS / 60_000,
  });

  it("puts the code in the subject so a notification preview is enough", () => {
    expect(rendered.subject).toContain("004 821");
  });

  it("carries the code and the link in both the text and the html part", () => {
    expect(rendered.text).toContain("004 821");
    expect(rendered.text).toContain("https://gw.test/api/auth/email/callback?token=abc&x=1");
    expect(rendered.html).toContain("004 821");
    // The `&` in the URL is escaped in the href, so the link is not truncated at
    // the query separator by an HTML parser.
    expect(rendered.html).toContain("token=abc&amp;x=1");
  });

  it("states the expiry and does not use a raw color", () => {
    expect(rendered.text).toContain("15 minutes");
    expect(rendered.html).toContain("15 minutes");
    // The design system bans raw color literals; a mail client cannot resolve a
    // token, so the template styles type and spacing only.
    expect(rendered.html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|color:/);
  });
});

describe("the origin cookie", () => {
  it("is only accepted under a name the browser pins to this origin", () => {
    // `__Host-` is refused by the browser unless Secure, path `/`, and no Domain —
    // which is what stops a sibling subdomain from setting one that would be sent
    // here. Losing the prefix would silently widen who can forge it.
    expect(ORIGIN_COOKIE.startsWith("__Host-")).toBe(true);
    const header = originCookie("tok");
    expect(header).toContain("Secure");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Path=/");
    expect(header).not.toContain("Domain=");
    // Lax would simply not be stored: the SPA and the gateway are different sites.
    expect(header).toContain("SameSite=None");
  });

  it("outlives the code, so a click a second late is not a different device", () => {
    const maxAge = Number(originCookie("tok").match(/Max-Age=(\d+)/)![1]);
    expect(maxAge).toBeGreaterThan(CODE_TTL_MS / 1000);
  });

  it("finds its cookie among others, and is not fooled by a name that ends the same", () => {
    expect(readOriginCookie(`a=1; ${ORIGIN_COOKIE}=wanted; z=2`)).toBe("wanted");
    expect(readOriginCookie(`x${ORIGIN_COOKIE}=spoof`)).toBe(null);
    expect(readOriginCookie(`${ORIGIN_COOKIE}=`)).toBe(null);
    expect(readOriginCookie(undefined)).toBe(null);
    expect(readOriginCookie("")).toBe(null);
    expect(readOriginCookie("malformed")).toBe(null);
  });

  it("round-trips through the header it is set with", () => {
    const token = generateOriginToken();
    expect(readOriginCookie(originCookie(token).split(";")[0]!)).toBe(token);
  });

  it("stores only a hash, and two tokens never collide", () => {
    const a = generateOriginToken();
    const b = generateOriginToken();
    expect(a).not.toBe(b);
    expect(hashOriginToken(a)).not.toBe(hashOriginToken(b));
    expect(hashOriginToken(a)).toBe(hashOriginToken(a));
    expect(hashOriginToken(a)).not.toContain(a);
  });
});

describe("isReviewDemoLogin", () => {
  const EMAIL = "review@lmthing.com";
  const CODE = "314159";

  function withDemo(email: string | undefined, code: string | undefined, fn: () => void) {
    const prevEmail = process.env.REVIEW_DEMO_EMAIL;
    const prevCode = process.env.REVIEW_DEMO_CODE;
    if (email === undefined) delete process.env.REVIEW_DEMO_EMAIL;
    else process.env.REVIEW_DEMO_EMAIL = email;
    if (code === undefined) delete process.env.REVIEW_DEMO_CODE;
    else process.env.REVIEW_DEMO_CODE = code;
    try {
      fn();
    } finally {
      if (prevEmail === undefined) delete process.env.REVIEW_DEMO_EMAIL;
      else process.env.REVIEW_DEMO_EMAIL = prevEmail;
      if (prevCode === undefined) delete process.env.REVIEW_DEMO_CODE;
      else process.env.REVIEW_DEMO_CODE = prevCode;
    }
  }

  // The property that matters most: an ordinary deployment has no bypass at all.
  it("is inert when unconfigured — this is a bypass, so absence is the default", () => {
    withDemo(undefined, undefined, () => {
      expect(isReviewDemoLogin(EMAIL, CODE)).toBe(false);
      expect(isReviewDemoLogin("", "")).toBe(false);
    });
  });

  it("stays inert when only one half is set, so a partial config opens nothing", () => {
    withDemo(EMAIL, undefined, () => {
      expect(isReviewDemoLogin(EMAIL, CODE)).toBe(false);
    });
    withDemo(undefined, CODE, () => {
      expect(isReviewDemoLogin(EMAIL, CODE)).toBe(false);
    });
  });

  it("accepts exactly the configured pair", () => {
    withDemo(EMAIL, CODE, () => {
      expect(isReviewDemoLogin(EMAIL, CODE)).toBe(true);
    });
  });

  it("rejects the right address with the wrong code, and the reverse", () => {
    withDemo(EMAIL, CODE, () => {
      expect(isReviewDemoLogin(EMAIL, "000000")).toBe(false);
      expect(isReviewDemoLogin("someone@example.com", CODE)).toBe(false);
      expect(isReviewDemoLogin("someone@example.com", "000000")).toBe(false);
    });
  });

  // The caller normalizes before this runs; the configured values go through the
  // same normalizers, so a stray space or capital in the ENV cannot lock the
  // reviewer out of an account whose credentials look correct.
  it("normalizes the configured side the same way the request side is normalized", () => {
    withDemo("  Review@LMTHING.com ", "314 159", () => {
      expect(isReviewDemoLogin(EMAIL, CODE)).toBe(true);
    });
  });

  it("refuses a configured code that is not a real 6-digit OTP", () => {
    withDemo(EMAIL, "12345", () => {
      expect(isReviewDemoLogin(EMAIL, "12345")).toBe(false);
    });
    withDemo(EMAIL, "not-a-code", () => {
      expect(isReviewDemoLogin(EMAIL, "not-a-code")).toBe(false);
    });
  });
});
