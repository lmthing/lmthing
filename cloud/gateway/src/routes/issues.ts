import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import {
  createOrgIssue,
  isIssuesConfigured,
  normalizeBase64,
  uploadBugArtifact,
} from "../lib/github-issues.js";
import { authMiddleware } from "../middleware/auth.js";
import type { Env } from "../types.js";

const issues = new Hono<Env>();

issues.use("*", authMiddleware);

interface IssueBody {
  title?: string;
  message?: string;
  trace?: string;
  screenshot?: string;
}

// File a bug report as a GitHub issue in the org repo, with the session
// trace and (optional) screenshot committed as artifacts for reference.
issues.post("/", async (c) => {
  if (!isIssuesConfigured()) {
    return c.json({ error: "issue reporting not configured" }, 501);
  }

  const body = await c.req.json<IssueBody>().catch(() => ({}) as IssueBody);
  const { title, message, trace, screenshot } = body;

  if (typeof title !== "string" || title.trim() === "") {
    return c.json({ error: "title is required" }, 400);
  }
  if (typeof message !== "string" || message.trim() === "") {
    return c.json({ error: "message is required" }, 400);
  }

  const user = c.get("user");
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;

  try {
    let traceBlobUrl: string | undefined;
    if (typeof trace === "string" && trace.trim() !== "") {
      const traceBase64 = Buffer.from(trace, "utf8").toString("base64");
      const uploaded = await uploadBugArtifact(
        `reports/${id}/trace.ndjson`,
        traceBase64,
        `bug report ${id} trace`,
      );
      traceBlobUrl = uploaded.blobUrl;
    }

    let screenshotRawUrl: string | undefined;
    let screenshotBlobUrl: string | undefined;
    if (typeof screenshot === "string" && screenshot.trim() !== "") {
      const screenshotBase64 = normalizeBase64(screenshot);
      const uploaded = await uploadBugArtifact(
        `reports/${id}/screenshot.png`,
        screenshotBase64,
        `bug report ${id} screenshot`,
      );
      screenshotRawUrl = uploaded.rawUrl;
      screenshotBlobUrl = uploaded.blobUrl;
    }

    const sections = [
      `**Reported by:** ${user.email}`,
      "",
      message,
      "",
      "---",
    ];
    if (screenshotRawUrl) {
      // Inline embed for the common case; a plain link as a fallback since a
      // private storage repo's raw image URL may not render through GitHub's
      // image proxy for all viewers.
      sections.push(
        "### Screenshot",
        `![screenshot](${screenshotRawUrl})`,
        "",
        `[Open screenshot](${screenshotBlobUrl ?? screenshotRawUrl})`,
        "",
      );
    }
    if (traceBlobUrl) {
      sections.push(`[Session trace](${traceBlobUrl})`);
    }

    const result = await createOrgIssue({ title, body: sections.join("\n") });
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 502);
  }
});

export default issues;
