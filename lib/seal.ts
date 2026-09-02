import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * AES-256-GCM seal for anything that has to live in an httpOnly cookie rather than in server
 * memory.
 *
 * Extracted from `lib/lp/session-seal.ts`, which had the only copy. A second demo surface needed
 * the same thing, and copying crypto is the kind of duplication that ages badly: the two would
 * drift, and the one nobody looked at would be the one still using the old scheme.
 *
 * `scope` separates the key derivations, so a cookie sealed for one surface cannot be presented to
 * another. It is not a secret — it is a domain separator.
 */
function encryptionKey(scope: string): Buffer {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is required to seal session cookies");
  }
  return createHash("sha256").update(`${scope}:${secret}`).digest();
}

/** Seals a JSON-serialisable payload into a base64url token suitable as a cookie value. */
export function sealJson(scope: string, payload: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(scope), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

/**
 * Returns the payload, or null. Never throws: a tampered or stale cookie is simply an absent
 * session, and GCM's tag means a modified ciphertext fails to decrypt rather than yielding
 * plausible garbage.
 */
export function unsealJson<T>(scope: string, token: string | undefined): T | null {
  if (!token) return null;
  try {
    const buf = Buffer.from(token, "base64url");
    if (buf.length < 12 + 16 + 1) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(scope), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch {
    return null;
  }
}
