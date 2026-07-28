/**
 * Delivering a notification to a user's devices.
 *
 * Two transports behind one contract, because the two clients cannot share one:
 *
 *  - **web** — the W3C Push API. A browser hands the page an endpoint URL plus a
 *    pair of encryption keys, and the payload must be encrypted to those keys and
 *    the request signed with our VAPID identity. Works in an installed PWA on
 *    Android with the app closed.
 *  - **expo** — Expo's push service, which fronts FCM (and APNs). The device
 *    token is the address and Expo does its own transport security, so there is
 *    nothing to encrypt here.
 *
 * The caller never picks. It names USERS; this module finds their devices and
 * uses whatever each one needs. That is what lets the pod stay ignorant of
 * whether somebody is on a phone.
 *
 * **Dead endpoints are deleted, not retried.** Both transports report a gone
 * device distinguishably (404/410 from Web Push, `DeviceNotRegistered` from
 * Expo), and keeping one means paying for a request that cannot succeed on every
 * future notification, forever.
 */

import webpush from "web-push";
import {
  deletePushSubscription,
  listPushSubscriptions,
  touchPushSubscriptions,
  type PushSubscription,
} from "./db.js";

export interface PushMessage {
  title: string;
  body: string;
  /** Where a tap should land, as a path on the team surface. */
  url: string;
  /** Collapses same-conversation notifications on the device. */
  tag: string;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Endpoints dropped because the device is gone. */
  pruned: number;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * VAPID is our identity to every browser push service. Configured once, lazily,
 * so the gateway boots and serves everything else even when push has not been
 * provisioned — which is the state a fresh environment is in.
 */
let vapidReady: boolean | null = null;
function configureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:support@lmthing.org";
  if (!publicKey || !privateKey) {
    vapidReady = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

/** The public half, which the browser needs in order to subscribe at all. */
export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

/** Whether push can be delivered at all — false until credentials exist. */
export function pushConfigured(): { web: boolean; expo: boolean } {
  return {
    web: configureVapid(),
    // Expo accepts unauthenticated sends for tokens it issued; an access token
    // is only required once a project enables enhanced security.
    expo: true,
  };
}

async function sendWeb(sub: PushSubscription, message: PushMessage): Promise<"sent" | "gone" | "failed"> {
  if (!configureVapid() || !sub.p256dh || !sub.auth) return "failed";
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(message),
      { TTL: 60 * 60 * 24 },
    );
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404 the endpoint never existed, 410 the browser revoked it. Either way it
    // will never work again.
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}

async function sendExpo(
  subs: PushSubscription[],
  message: PushMessage,
): Promise<{ sent: string[]; gone: string[]; failed: string[] }> {
  const sent: string[] = [];
  const gone: string[] = [];
  const failed: string[] = [];
  if (!subs.length) return { sent, gone, failed };

  // Expo takes a batch, and batching is not an optimisation here: it is the
  // documented interface, and per-token requests get rate limited.
  const body = subs.map((s) => ({
    to: s.endpoint,
    title: message.title,
    body: message.body,
    data: { url: message.url },
    // Android collapses on this; without it a chatty channel stacks up a column
    // of notifications for one conversation.
    collapseId: message.tag,
    channelId: "messages",
    sound: "default",
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(process.env.EXPO_ACCESS_TOKEN
          ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      failed.push(...subs.map((s) => s.endpoint));
      return { sent, gone, failed };
    }
    const payload = (await res.json()) as {
      data?: Array<{ status?: string; details?: { error?: string } }>;
    };
    // Expo answers positionally, one ticket per token, in the order sent.
    subs.forEach((sub, i) => {
      const ticket = payload.data?.[i];
      if (ticket?.status === "ok") sent.push(sub.endpoint);
      else if (ticket?.details?.error === "DeviceNotRegistered") gone.push(sub.endpoint);
      else failed.push(sub.endpoint);
    });
  } catch {
    failed.push(...subs.map((s) => s.endpoint));
  }
  return { sent, gone, failed };
}

/**
 * Notify these users on every device they have registered.
 *
 * Never throws. A notification is a courtesy on top of a message that has
 * already been delivered and badged; failing to send one must not fail whatever
 * asked for it.
 */
export async function pushToUsers(
  userIds: readonly string[],
  message: PushMessage,
): Promise<PushResult> {
  const subs = await listPushSubscriptions(userIds);
  if (!subs.length) return { sent: 0, failed: 0, pruned: 0 };

  const web = subs.filter((s) => s.kind === "web");
  const expo = subs.filter((s) => s.kind === "expo");

  const [webResults, expoResult] = await Promise.all([
    Promise.all(web.map(async (s) => ({ endpoint: s.endpoint, outcome: await sendWeb(s, message) }))),
    sendExpo(expo, message),
  ]);

  const sent = [
    ...webResults.filter((r) => r.outcome === "sent").map((r) => r.endpoint),
    ...expoResult.sent,
  ];
  const gone = [
    ...webResults.filter((r) => r.outcome === "gone").map((r) => r.endpoint),
    ...expoResult.gone,
  ];
  const failed =
    webResults.filter((r) => r.outcome === "failed").length + expoResult.failed.length;

  await Promise.all([
    touchPushSubscriptions(sent),
    ...gone.map((endpoint) => deletePushSubscription(endpoint)),
  ]);

  return { sent: sent.length, failed, pruned: gone.length };
}
