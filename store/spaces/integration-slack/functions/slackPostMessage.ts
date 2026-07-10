/**
 * Post a message to a Slack channel (POST /chat.postMessage on the Slack Web API).
 *
 * The gateway pins the base to `https://slack.com/api`, so the path is the leading-slash method
 * name. Slack accepts a JSON body for chat.postMessage.
 *
 * @param channel   Channel id (e.g. "C0123ABCD") or, for some workspaces, a #name. Prefer an id —
 *                  resolve names via slackListChannels first.
 * @param text      Message text (Slack mrkdwn is supported).
 * @param threadTs  Optional parent message `ts` to reply IN-THREAD (e.g. the `thread_ts`/`ts` from
 *                  an inbound Slack event) so a channel reply lands under the original message
 *                  instead of at the channel root.
 * @returns The Slack response envelope: { ok: boolean; ts?: string; channel?: string; error?: string; message?: any }
 */
export async function slackPostMessage(channel: string, text: string, threadTs?: string): Promise<any> {
  const body: Record<string, unknown> = { channel, text };
  if (threadTs) body['thread_ts'] = threadTs;
  const r = await callConnection('slack', {
    method: 'POST',
    path: '/chat.postMessage',
    body,
  });
  return r.data;
}
