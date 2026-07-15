import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/** Durable LP demo credentials — sealed into the httpOnly cookie for serverless. */
export type LpSealedPayload = {
  v: 1;
  apiPrivateKey: string;
  eoaPrivateKey: string;
  apiKeyTruncated: string;
  eoaAddress: string;
  proxyWallet: string;
  allowanceStatus: string | null;
  createdAt: number;
};

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is required for LP session cookies");
  }
  return createHash("sha256").update(`lp-demo:${secret}`).digest();
}

/** AES-256-GCM seal → base64url token suitable as a cookie value. */
export function sealLpSession(payload: LpSealedPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function unsealLpSession(token: string): LpSealedPayload | null {
  try {
    const buf = Buffer.from(token, "base64url");
    if (buf.length < 12 + 16 + 1) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    const parsed = JSON.parse(plain.toString("utf8")) as LpSealedPayload;
    if (
      parsed?.v !== 1 ||
      typeof parsed.apiPrivateKey !== "string" ||
      typeof parsed.eoaPrivateKey !== "string" ||
      !parsed.apiPrivateKey ||
      !parsed.eoaPrivateKey
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
