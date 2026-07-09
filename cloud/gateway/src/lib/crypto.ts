import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM encryption for OAuth tokens at rest.
 *
 * The codebase stores `installation_id` in plaintext but never a raw OAuth
 * token; connection access/refresh tokens are long-lived bearer credentials to
 * third-party accounts, so we encrypt them before they touch Postgres. The key
 * is a base64-encoded 32-byte value from `CONNECTIONS_ENC_KEY` (same shape as
 * GATEWAY_JWT_SECRET is read in tokens.ts). Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * The stored form is `base64(iv):base64(authTag):base64(ciphertext)` so the iv
 * and GCM auth tag travel with the ciphertext.
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the GCM standard

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.CONNECTIONS_ENC_KEY;
  if (!raw) {
    throw new Error(
      "CONNECTIONS_ENC_KEY is not set — cannot encrypt/decrypt connection tokens",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `CONNECTIONS_ENC_KEY must decode to 32 bytes (got ${key.length})`,
    );
  }
  cachedKey = key;
  return key;
}

/** Encrypt a UTF-8 plaintext → `iv:tag:ciphertext` (all base64). */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Decrypt an `iv:tag:ciphertext` (base64) string back to UTF-8 plaintext. */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed ciphertext (expected iv:tag:ct)");
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
