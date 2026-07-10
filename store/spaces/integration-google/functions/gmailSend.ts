/**
 * Send a plain-text email from the user's Gmail account
 * (POST /gmail/v1/users/me/messages/send).
 *
 * Gmail wants the whole RFC-2822 message base64url-encoded in the `raw` field. We build the
 * message and encode it with a tiny self-contained UTF-8 → base64url helper (no imports are
 * allowed in a space function's sandbox).
 *
 * @param to       Recipient email address.
 * @param subject  Subject line.
 * @param body     Plain-text body.
 * @returns The sent-message resource: { id: string; threadId: string; labelIds?: string[] }
 */
export async function gmailSend(to: string, subject: string, body: string): Promise<any> {
  // UTF-8 encode then base64url (RFC 4648 §5, no padding) — pure, no Buffer/btoa/node imports.
  const toBase64Url = (input: string): string => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes: number[] = [];
    for (let i = 0; i < input.length; i++) {
      let c = input.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff) {
        // High surrogate — combine with the following low surrogate into a code point.
        const c2 = input.charCodeAt(++i);
        c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i];
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : -1;
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : -1;
      const n = (b0 << 16) | ((b1 < 0 ? 0 : b1) << 8) | (b2 < 0 ? 0 : b2);
      out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63];
      out += b1 < 0 ? '' : alphabet[(n >> 6) & 63];
      out += b2 < 0 ? '' : alphabet[n & 63];
    }
    return out.replace(/\+/g, '-').replace(/\//g, '_');
  };

  const message =
    'To: ' + to + '\r\n' +
    'Subject: ' + subject + '\r\n' +
    'MIME-Version: 1.0\r\n' +
    'Content-Type: text/plain; charset="UTF-8"\r\n' +
    '\r\n' +
    body;

  const r = await callConnection('google', {
    method: 'POST',
    path: '/gmail/v1/users/me/messages/send',
    body: { raw: toBase64Url(message) },
  });
  return r.data;
}
