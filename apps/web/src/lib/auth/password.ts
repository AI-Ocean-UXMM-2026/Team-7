import crypto from "node:crypto";

const KEY_LENGTH = 64;

/**
 * Hash a plain text password using scrypt with a cryptographically secure random salt.
 * Format: `<salt_hex>:<derived_key_hex>`
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify a plain text password against a stored `<salt_hex>:<derived_key_hex>` hash.
 * Uses constant-time comparison to prevent timing attacks.
 * Fails closed on missing, malformed, or invalid hashes.
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!password || !storedHash || typeof storedHash !== "string") {
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }

  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) {
    return false;
  }

  try {
    const expectedBuf = Buffer.from(expectedHex, "hex");
    if (expectedBuf.length !== KEY_LENGTH) {
      return false;
    }

    const actualBuf = crypto.scryptSync(password, salt, KEY_LENGTH);
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}
