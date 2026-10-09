import { createHash, randomBytes } from "node:crypto";

export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TTL_MS = 30 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export function newSecretToken(): { raw: string; hash: Buffer } {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest();
  return { raw, hash };
}

export function hashSecretToken(raw: string): Buffer {
  return createHash("sha256").update(raw).digest();
}
