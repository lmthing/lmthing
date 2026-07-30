// A minimal, dependency-free SMTP submission client.
//
// The gateway needs to send exactly one kind of mail — a passwordless sign-in
// code + link — and the whole image is built with `npm ci` from
// cloud/gateway/package-lock.json plus the root pnpm lockfile. Pulling a mailer
// dependency in to send one message would mean keeping two lockfiles and the CI
// image build in step for a conversation that is a dozen lines of RFC 5321. So
// this speaks the protocol directly over node:net / node:tls.
//
// It implements only the submission subset that matters: EHLO, optional
// STARTTLS upgrade, AUTH PLAIN or AUTH LOGIN, one MAIL FROM, one RCPT TO, DATA.
// Bodies are base64-encoded (`Content-Transfer-Encoding: base64`), which side-
// steps the line-length and bare-newline rules entirely — a base64 line can
// never exceed 76 chars or start with a "." — and non-ASCII headers are RFC 2047
// encoded. Dot-stuffing is still applied, defensively.
//
// Anything beyond that (pipelining, DSN, multiple recipients, 8BITMIME, XOAUTH2)
// is deliberately absent: a provider that needs it is reached through the HTTP
// transport in ./email.ts instead.

import net from "node:net";
import tls from "node:tls";
import crypto from "node:crypto";

/** How the connection is protected. Port 465 is `tls`; 587 is normally `starttls`. */
export type SmtpSecurity = "tls" | "starttls" | "none";

export interface SmtpConfig {
  host: string;
  port: number;
  security: SmtpSecurity;
  user?: string;
  pass?: string;
  /** EHLO name. Defaults to the local hostname-ish "lmthing-gateway". */
  clientName?: string;
  /** Set false only to talk to a self-signed relay. */
  rejectUnauthorized?: boolean;
  /** Per-command timeout in ms. */
  timeoutMs?: number;
}

export interface Mail {
  /** Envelope + header sender, e.g. `lmthing <no-reply@lmthing.cloud>`. */
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const DEFAULT_TIMEOUT_MS = 20_000;

export class SmtpError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "SmtpError";
  }
}

// ─── Address + header encoding ────────────────────────────────────────────────

/**
 * The bare address out of `Name <addr@host>` (or the input, already bare).
 *
 * SMTP envelope commands take the addr-spec ONLY — sending `MAIL
 * FROM:<lmthing <no-reply@x>>` is a syntax error every server rejects, which is
 * the single easiest way to get this wrong.
 */
export function addrSpec(address: string): string {
  const m = address.match(/<([^>]+)>\s*$/);
  return (m ? m[1]! : address).trim();
}

/** RFC 2047 encode a header value, but only when it actually needs it. */
export function encodeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (!/[^\x20-\x7e]/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** RFC 5322 date — an explicit numeric offset, not `toUTCString`'s obsolete "GMT". */
export function rfc5322Date(now: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${days[now.getUTCDay()]}, ${p(now.getUTCDate())} ${months[now.getUTCMonth()]} ` +
    `${now.getUTCFullYear()} ${p(now.getUTCHours())}:${p(now.getUTCMinutes())}:` +
    `${p(now.getUTCSeconds())} +0000`
  );
}

function base64Body(body: string): string {
  const b64 = Buffer.from(body, "utf8").toString("base64");
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
  return lines.join("\r\n");
}

/**
 * Build the RFC 5322 message. `multipart/alternative` when `html` is present so
 * a text-only client still shows the code, `text/plain` when it isn't.
 */
export function buildMessage(
  mail: Mail,
  opts: { date?: Date; boundary?: string; messageId?: string } = {},
): string {
  const date = opts.date ?? new Date();
  const domain = addrSpec(mail.from).split("@")[1] ?? "lmthing.cloud";
  const messageId =
    opts.messageId ?? `<${crypto.randomUUID()}@${domain}>`;

  const headers = [
    `From: ${mail.from}`,
    `To: ${mail.to}`,
    `Subject: ${encodeHeaderValue(mail.subject)}`,
    `Date: ${rfc5322Date(date)}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    // A sign-in code is transactional: keep it out of auto-reply loops and out
    // of "unsubscribe" heuristics that would otherwise junk it.
    "Auto-Submitted: auto-generated",
  ];

  if (!mail.html) {
    return [
      ...headers,
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: base64",
      "",
      base64Body(mail.text),
      "",
    ].join("\r\n");
  }

  const boundary = opts.boundary ?? `lm-${crypto.randomBytes(12).toString("hex")}`;
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Body(mail.text),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Body(mail.html),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** Dot-stuff and CRLF-normalize a message for the DATA payload. */
export function dataPayload(message: string): string {
  const normalized = message.replace(/\r\n|\r|\n/g, "\r\n");
  const stuffed = normalized.replace(/^\./gm, "..");
  return `${stuffed.endsWith("\r\n") ? stuffed : `${stuffed}\r\n`}.\r\n`;
}

// ─── The conversation ─────────────────────────────────────────────────────────

interface Reply {
  code: number;
  lines: string[];
}

/**
 * Line-oriented reader over a socket. SMTP replies are `NNN-continuation` lines
 * terminated by one `NNN final` line, so a reply is only complete when a line's
 * 4th character is a space.
 */
class ReplyReader {
  private buffer = "";
  private pending: { resolve: (r: Reply) => void; reject: (e: Error) => void }[] = [];
  private queued: Reply[] = [];
  private failure: Error | null = null;

  /**
   * Start reading replies off `socket`; returns a detach function.
   *
   * Deliberately does NOT call `setEncoding` and detaching is deliberately
   * possible: a STARTTLS upgrade hands the raw socket to `tls.connect`, which
   * needs it un-decoded and not already flowing under someone else's `data`
   * listener. Replies are ASCII, so decoding each chunk here loses nothing.
   */
  attach(socket: net.Socket): () => void {
    const onData = (chunk: Buffer) => this.onData(chunk.toString("utf8"));
    socket.on("data", onData);
    return () => socket.off("data", onData);
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let idx: number;
    const lines: string[] = [];
    while ((idx = this.buffer.indexOf("\r\n")) !== -1) {
      lines.push(this.buffer.slice(0, idx));
      this.buffer = this.buffer.slice(idx + 2);
    }
    for (const line of lines) this.onLine(line);
  }

  private partial: string[] = [];

  private onLine(line: string): void {
    this.partial.push(line);
    // Continuation lines have "-" as the 4th char; the final one has " " (or the
    // line is too short to have either, which we treat as final).
    if (line.length >= 4 && line[3] === "-") return;
    const code = Number.parseInt(this.partial[0]!.slice(0, 3), 10);
    const reply: Reply = { code, lines: this.partial.map((l) => l.slice(4)) };
    this.partial = [];
    const waiter = this.pending.shift();
    if (waiter) waiter.resolve(reply);
    else this.queued.push(reply);
  }

  /** Fail every waiter — a socket error/close must not leave a hung promise. */
  fail(err: Error): void {
    this.failure = err;
    const waiters = this.pending;
    this.pending = [];
    for (const w of waiters) w.reject(err);
  }

  next(): Promise<Reply> {
    const queued = this.queued.shift();
    if (queued) return Promise.resolve(queued);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
  }
}

function write(socket: net.Socket, data: string): void {
  socket.write(data);
}

async function expect(
  reader: ReplyReader,
  codes: number[],
  what: string,
): Promise<Reply> {
  const reply = await reader.next();
  if (!codes.includes(reply.code)) {
    throw new SmtpError(
      `SMTP ${what} failed: ${reply.code} ${reply.lines.join(" ")}`,
      reply.code,
    );
  }
  return reply;
}

async function command(
  socket: net.Socket,
  reader: ReplyReader,
  line: string,
  codes: number[],
  what: string,
): Promise<Reply> {
  write(socket, `${line}\r\n`);
  return expect(reader, codes, what);
}

function connect(cfg: SmtpConfig): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    if (cfg.security === "tls") {
      const socket = tls.connect(
        {
          host: cfg.host,
          port: cfg.port,
          servername: cfg.host,
          rejectUnauthorized: cfg.rejectUnauthorized ?? true,
        },
        () => {
          socket.off("error", onError);
          resolve(socket);
        },
      );
      socket.once("error", onError);
      return;
    }
    const socket = net.connect({ host: cfg.host, port: cfg.port }, () => {
      socket.off("error", onError);
      resolve(socket);
    });
    socket.once("error", onError);
  });
}

function upgrade(socket: net.Socket, cfg: SmtpConfig): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    const secure = tls.connect(
      {
        socket,
        servername: cfg.host,
        rejectUnauthorized: cfg.rejectUnauthorized ?? true,
      },
      () => {
        secure.off("error", onError);
        resolve(secure);
      },
    );
    secure.once("error", onError);
  });
}

/** Capability names advertised by EHLO, upper-cased, verb only. */
function capabilities(reply: Reply): Set<string> {
  const caps = new Set<string>();
  // Skip line 0 — it's the greeting/domain, not a capability.
  for (const line of reply.lines.slice(1)) {
    const verb = line.trim().split(/\s+/)[0];
    if (verb) caps.add(verb.toUpperCase());
  }
  return caps;
}

function authMechanisms(reply: Reply): Set<string> {
  const mechs = new Set<string>();
  for (const line of reply.lines.slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts[0]?.toUpperCase() !== "AUTH") continue;
    for (const m of parts.slice(1)) mechs.add(m.toUpperCase());
  }
  return mechs;
}

/**
 * Send one message. Resolves when the server has accepted the DATA payload
 * (a `250` after the terminating dot) — the point at which the message is the
 * relay's responsibility, not ours.
 */
export async function sendSmtp(cfg: SmtpConfig, mail: Mail): Promise<void> {
  const timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const clientName = cfg.clientName ?? "lmthing-gateway";
  const reader = new ReplyReader();

  let socket = await connect(cfg);
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    socket.destroy();
  };

  // Every socket the conversation runs over — the original and any STARTTLS
  // upgrade — must fail the reader on error/close/timeout, or a lost connection
  // leaves `reader.next()` hanging forever instead of rejecting.
  const watch = (s: net.Socket): (() => void) => {
    s.setTimeout(timeoutMs, () => {
      const err = new SmtpError(`SMTP timeout after ${timeoutMs}ms`);
      reader.fail(err);
      s.destroy(err);
    });
    s.on("error", (err) => reader.fail(err));
    s.on("close", () =>
      reader.fail(new SmtpError("SMTP connection closed unexpectedly")),
    );
    return reader.attach(s);
  };

  try {
    let detach = watch(socket);

    await expect(reader, [220], "greeting");
    let ehlo = await command(socket, reader, `EHLO ${clientName}`, [250], "EHLO");

    if (cfg.security === "starttls") {
      if (!capabilities(ehlo).has("STARTTLS")) {
        throw new SmtpError(
          "SMTP server does not advertise STARTTLS — refusing to send credentials in the clear",
        );
      }
      await command(socket, reader, "STARTTLS", [220], "STARTTLS");
      // Hand the raw socket over un-consumed: with our `data` listener still on
      // it, the socket stays in flowing mode and the TLS handshake never sees
      // the server's bytes.
      detach();
      const secure = await upgrade(socket, cfg);
      socket = secure;
      detach = watch(secure);
      // The capability list is re-issued after the upgrade; the pre-TLS one is
      // not trustworthy and typically omits AUTH.
      ehlo = await command(socket, reader, `EHLO ${clientName}`, [250], "EHLO (post-STARTTLS)");
    }

    if (cfg.user && cfg.pass) {
      const mechs = authMechanisms(ehlo);
      if (mechs.has("PLAIN") || mechs.size === 0) {
        const token = Buffer.from(`\0${cfg.user}\0${cfg.pass}`, "utf8").toString("base64");
        await command(socket, reader, `AUTH PLAIN ${token}`, [235], "AUTH PLAIN");
      } else if (mechs.has("LOGIN")) {
        await command(socket, reader, "AUTH LOGIN", [334], "AUTH LOGIN");
        await command(
          socket,
          reader,
          Buffer.from(cfg.user, "utf8").toString("base64"),
          [334],
          "AUTH LOGIN (username)",
        );
        await command(
          socket,
          reader,
          Buffer.from(cfg.pass, "utf8").toString("base64"),
          [235],
          "AUTH LOGIN (password)",
        );
      } else {
        throw new SmtpError(
          `SMTP server offers no supported AUTH mechanism (has: ${[...mechs].join(", ") || "none"})`,
        );
      }
    }

    await command(
      socket,
      reader,
      `MAIL FROM:<${addrSpec(mail.from)}>`,
      [250],
      "MAIL FROM",
    );
    await command(
      socket,
      reader,
      `RCPT TO:<${addrSpec(mail.to)}>`,
      [250, 251],
      "RCPT TO",
    );
    await command(socket, reader, "DATA", [354], "DATA");

    write(socket, dataPayload(buildMessage(mail)));
    await expect(reader, [250], "message body");

    // Best-effort: the message is already accepted, so a failed QUIT is noise.
    write(socket, "QUIT\r\n");
    await reader.next().catch(() => undefined);
  } finally {
    cleanup();
  }
}
