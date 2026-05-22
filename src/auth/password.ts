import crypto from "crypto";

const ITERATIONS = 120_000;
const KEYLEN = 32;
const DIGEST = "sha256";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [kind, iterationsRaw, salt, expected] = stored.split("$");
    if (kind !== "pbkdf2" || !iterationsRaw || !salt || !expected) return false;
    const iterations = Number(iterationsRaw);
    const actual = crypto.pbkdf2Sync(password, salt, iterations, KEYLEN, DIGEST).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
