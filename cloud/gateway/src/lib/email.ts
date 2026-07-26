// Outbound transactional email for the gateway.
//
// Three transports, selected from the environment, all behind one `sendEmail`:
//
//   resend   — HTTPS POST to api.resend.com (just `fetch`; nothing to install)
//   smtp     — any submission relay, via the dependency-free client in ./smtp.ts
//   console  — writes the message to stdout instead of sending it
//
// `console` exists so a developer can run the whole passwordless sign-in flow
// with no mail credentials at all: the code and the magic link are printed to
// the gateway log. It is NOT a silent fallback in production — a deployment with
// no mail configuration reports `configured: false` and the sign-in route
// refuses to pretend a mail was sent unless `EMAIL_DEV_ECHO=true` is also set
// (see routes/auth.ts), because an unverifiable code is an auth bypass, not a
// degraded experience.
//
// Env is read per call, not at import time, so a test can flip transports and
// the k8s Deployment can add credentials without a code change.

import { sendSmtp, type SmtpSecurity } from "./smtp.js";

export type MailerKind = "resend" | "smtp" | "console";

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Which transport this process will use.
 *
 * `EMAIL_PROVIDER` wins when set to a known value; otherwise the presence of
 * credentials decides, so adding `RESEND_API_KEY` or `SMTP_HOST` to the secret
 * is the only step needed to turn real mail on.
 */
export function mailerKind(): MailerKind {
  const explicit = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "resend" || explicit === "smtp" || explicit === "console") {
    return explicit;
  }
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST) return "smtp";
  return "console";
}

/** True when mail actually leaves the process. */
export function isEmailConfigured(): boolean {
  return mailerKind() !== "console";
}

/** `Name <addr>` used as the From header + SMTP envelope sender. */
export function fromAddress(): string {
  const addr = process.env.EMAIL_FROM?.trim() || defaultFrom();
  const name = process.env.EMAIL_FROM_NAME?.trim() || "lmthing";
  return addr.includes("<") ? addr : `${name} <${addr}>`;
}

function defaultFrom(): string {
  try {
    return `no-reply@${new URL(process.env.BASE_URL!).hostname}`;
  } catch {
    return "no-reply@lmthing.cloud";
  }
}

function smtpSecurity(port: number): SmtpSecurity {
  const explicit = (process.env.SMTP_SECURITY ?? "").trim().toLowerCase();
  if (explicit === "tls" || explicit === "starttls" || explicit === "none") {
    return explicit;
  }
  // 465 is implicit TLS ("smtps"); everything else submits over STARTTLS. A
  // plaintext relay has to be asked for explicitly — defaulting to it would
  // send credentials in the clear on a misconfigured port.
  return port === 465 ? "tls" : "starttls";
}

async function sendViaResend(email: OutboundEmail): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend rejected the message (${res.status}): ${body.slice(0, 300)}`);
  }
}

async function sendViaSmtp(email: OutboundEmail): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) throw new Error("SMTP_HOST is not set");
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);

  await sendSmtp(
    {
      host,
      port: Number.isFinite(port) ? port : 587,
      security: smtpSecurity(port),
      user: process.env.SMTP_USER?.trim() || undefined,
      pass: process.env.SMTP_PASSWORD ?? undefined,
      rejectUnauthorized: process.env.SMTP_INSECURE !== "true",
    },
    {
      from: fromAddress(),
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    },
  );
}

function sendViaConsole(email: OutboundEmail): void {
  console.log(
    [
      "",
      "──────── email (no mail transport configured) ────────",
      `To:      ${email.to}`,
      `From:    ${fromAddress()}`,
      `Subject: ${email.subject}`,
      "",
      email.text,
      "──────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

/** Send one message through the configured transport. Throws on delivery failure. */
export async function sendEmail(email: OutboundEmail): Promise<void> {
  switch (mailerKind()) {
    case "resend":
      return sendViaResend(email);
    case "smtp":
      return sendViaSmtp(email);
    case "console":
      return sendViaConsole(email);
  }
}
