/**
 * Send an SMS text message (POST /Messages.json on the Twilio REST API).
 *
 * The pod pins the base to `https://api.twilio.com/2010-04-01/Accounts/<SID>`, so the path is the
 * leading-slash `/Messages.json` resource. Twilio is FORM-encoded (not JSON), so the body is a
 * hand-built `application/x-www-form-urlencoded` string — each value is `encodeURIComponent`'d.
 *
 * @param to    Recipient number in E.164 (e.g. "+15551234567").
 * @param body  Message text. Keep it short — long text is split into billed 160-char segments.
 * @param from  The sender: one of YOUR Twilio numbers in E.164 (typically INTEGRATION_SMS_FROM_NUMBER; when
 *              replying to an inbound message, pass the inbound `To` field instead).
 * @returns The Twilio message resource: { sid, status, to, from, body, ... } on success, or an
 *          error object { code, message, status, more_info } on failure.
 */
export async function smsSend(to: string, body: string, from: string): Promise<any> {
  const form =
    'To=' + encodeURIComponent(to) +
    '&From=' + encodeURIComponent(from) +
    '&Body=' + encodeURIComponent(body);
  const r = await callConnection('sms', {
    method: 'POST',
    path: '/Messages.json',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  return r.data;
}
