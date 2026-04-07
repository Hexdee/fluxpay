import crypto from "crypto";
import { ulid } from "ulid";

export function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(prefix: string) {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

export function entityId(prefix: string) {
  return `${prefix}_${ulid()}`;
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [salt, storedHash] = encoded.split(":");
  if (!salt || !storedHash) return false;

  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(derived, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function randomNumericCode(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}
