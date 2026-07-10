/**
 * Send an MMS message with a media attachment (POST /Messages.json on the Twilio REST API).
 *
 * Same as smsSend but adds a `MediaUrl` — a PUBLICLY reachable https URL to an image/gif/pdf that
 * Twilio fetches and attaches. Twilio is FORM-encoded, so the body is a hand-built
 * `application/x-www-form-urlencoded` string with each value `encodeURIComponent`'d.
 *
 * @param to        Recipient number in E.164 (e.g. "+15551234567").
 * @param body      Message text (may be empty if you only want to send media).
 * @param mediaUrl  Public https URL of the media to attach.
 * @param from      The sender: one of YOUR Twilio (MMS-capable) numbers in E.164.
 * @returns The Twilio message resource: { sid, status, ... } on success, or { code, message, status }.
 */
export async function smsSendMms(to: string, body: string, mediaUrl: string, from: string): Promise<any> {
  const form =
    'To=' + encodeURIComponent(to) +
    '&From=' + encodeURIComponent(from) +
    '&Body=' + encodeURIComponent(body) +
    '&MediaUrl=' + encodeURIComponent(mediaUrl);
  const r = await callConnection('sms', {
    method: 'POST',
    path: '/Messages.json',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  return r.data;
}
