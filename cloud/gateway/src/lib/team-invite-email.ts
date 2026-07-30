// The mail a team invite sends.
//
// Two shapes, because being added to a team means two different things depending
// on whether the address already has an account:
//
//   `added`   — the account exists and is already a member. Nothing is required
//               of them; this is a notification, and it must not pretend to be an
//               action ("accept your invite" for something already accepted is
//               how a user ends up clicking around looking for a button).
//   `invited` — no account yet. There IS something to do: sign in with this
//               address (passwordless, so no password to invent) and accept.
//
// Pure — no mailer, no db, no env. `routes/teams.ts` composes it with sendEmail.

import { escapeHtml } from "./email-login.js";

export type TeamInviteKind = "added" | "invited";

export interface TeamInviteEmail {
  subject: string;
  text: string;
  html: string;
}

const WRAP =
  'font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;max-width:480px';

/**
 * `invitedBy` is the inviter's email address, and `teamName` is free text the
 * inviter chose — both are interpolated, so both go through `escapeHtml` on the
 * HTML side. The text part needs no escaping but must not be built by stripping
 * tags from the HTML one, which is how the two drift.
 */
export function renderTeamInviteEmail(opts: {
  kind: TeamInviteKind;
  teamName: string;
  invitedBy: string;
  link: string;
  /** Only meaningful for `invited` — an `added` member has nothing pending. */
  expiresAt?: Date | null;
}): TeamInviteEmail {
  const { kind, teamName, invitedBy, link, expiresAt } = opts;

  if (kind === "added") {
    const text = [
      `${invitedBy} added you to the team "${teamName}" on lmthing.`,
      "",
      "It is already on your account — open it here:",
      link,
      "",
      "If you don't recognise this team, you can leave it from the team's members list.",
    ].join("\n");

    const html = [
      `<div style="${WRAP}">`,
      `<p style="margin:0 0 20px"><strong>${escapeHtml(invitedBy)}</strong> added you to the team <strong>${escapeHtml(teamName)}</strong> on lmthing.</p>`,
      `<p style="margin:0 0 24px">It is already on your account &mdash; <a href="${escapeHtml(link)}">open it here</a>.</p>`,
      `<p style="margin:0;font-size:13px;opacity:0.7">If you don&rsquo;t recognise this team, you can leave it from the team&rsquo;s members list.</p>`,
      "</div>",
    ].join("");

    return { subject: `You've been added to ${teamName} on lmthing`, text, html };
  }

  // An invite is claimed by signing in with THIS address — say so, because the
  // recipient has no account and would otherwise not know what is being asked.
  const expiry = expiresAt
    ? `This invite expires on ${expiresAt.toISOString().slice(0, 10)}.`
    : "";

  const text = [
    `${invitedBy} invited you to the team "${teamName}" on lmthing.`,
    "",
    `To join, open the link below and sign in with this email address — there is no password, we email you a code.`,
    link,
    "",
    expiry,
    "",
    "If you weren't expecting this, you can ignore this email — nothing has been created for you.",
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");

  const html = [
    `<div style="${WRAP}">`,
    `<p style="margin:0 0 20px"><strong>${escapeHtml(invitedBy)}</strong> invited you to the team <strong>${escapeHtml(teamName)}</strong> on lmthing.</p>`,
    `<p style="margin:0 0 24px">To join, <a href="${escapeHtml(link)}">open lmthing and sign in with this email address</a>. There is no password &mdash; we email you a code.</p>`,
    expiry ? `<p style="margin:0 0 8px;font-size:13px;opacity:0.7">${escapeHtml(expiry)}</p>` : "",
    `<p style="margin:0;font-size:13px;opacity:0.7">If you weren&rsquo;t expecting this, you can ignore this email &mdash; nothing has been created for you.</p>`,
    "</div>",
  ].join("");

  return { subject: `${invitedBy} invited you to ${teamName} on lmthing`, text, html };
}
