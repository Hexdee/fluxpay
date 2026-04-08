import type { NextFunction, Request, Response } from "express";
import { mutateStore, readStore } from "./db.js";
import { entityId, randomToken, sha256Hex, verifyPassword } from "./utils.js";
import type { Merchant, MerchantSession } from "./types.js";
import { config } from "./config.js";

export type AuthedRequest = Request & {
  merchant: Merchant;
};

export function extractBearerToken(value: string | undefined) {
  if (!value) return null;
  const [scheme, token] = value.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function getMerchantByApiKey(token: string) {
  const hashed = sha256Hex(token);
  const store = await readStore();
  const direct = store.merchants.find((entry) => entry.apiKeyHash === hashed) ?? null;
  if (direct) return direct;

  const key = store.dashboard.apiKeys.find((entry) => {
    const secretHash = typeof (entry as any).secretHash === "string" ? String((entry as any).secretHash) : "";
    if (!secretHash) return false;
    if (secretHash !== hashed) return false;
    const status = String((entry as any).status ?? "active").toLowerCase();
    if (status !== "active") return false;
    const sunsetAt = typeof (entry as any).sunsetAt === "string" ? String((entry as any).sunsetAt) : "";
    if (sunsetAt && new Date(sunsetAt).getTime() <= Date.now()) return false;
    return true;
  }) as any | undefined;

  if (!key) return null;
  const merchantId = typeof key.merchantId === "string" ? key.merchantId : null;
  if (!merchantId) return null;
  return store.merchants.find((entry) => entry.merchantId === merchantId) ?? null;
}

export async function getMerchantByEmail(email: string) {
  const store = await readStore();
  return store.merchants.find((entry) => entry.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function authenticateMerchant(email: string, password: string) {
  const merchant = await getMerchantByEmail(email);
  if (!merchant) return null;
  if (!merchant.passwordHash) return null;
  return verifyPassword(password, merchant.passwordHash) ? merchant : null;
}

function isSessionActive(session: MerchantSession) {
  return !session.revokedAt && new Date(session.expiresAt).getTime() > Date.now();
}

export async function createSessionToken(merchantId: string) {
  const token = randomToken("sess");
  const tokenHash = sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionTtlMs).toISOString();

  await mutateStore((store) => {
    store.sessions.push({
      id: entityId("ses"),
      merchantId,
      tokenHash,
      createdAt: now.toISOString(),
      expiresAt,
      revokedAt: null,
    });
  });

  return { token, expiresAt };
}

export async function getMerchantBySessionToken(token: string) {
  const hashed = sha256Hex(token);
  const store = await readStore();
  const session = store.sessions.find((entry) => entry.tokenHash === hashed);
  if (!session || !isSessionActive(session)) {
    return null;
  }

  return store.merchants.find((entry) => entry.merchantId === session.merchantId) ?? null;
}

export async function revokeSessionsForMerchant(merchantId: string) {
  const now = new Date().toISOString();
  await mutateStore((store) => {
    store.sessions.forEach((session) => {
      if (session.merchantId === merchantId && !session.revokedAt) {
        session.revokedAt = now;
      }
    });
  });
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: "Missing API key" });
    return;
  }

  const merchant = await getMerchantByApiKey(token);

  if (!merchant) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  (req as AuthedRequest).merchant = merchant;
  next();
}

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: "Missing session token" });
    return;
  }

  const merchant = await getMerchantBySessionToken(token);
  if (!merchant) {
    res.status(401).json({ error: "Invalid or expired session token" });
    return;
  }

  (req as AuthedRequest).merchant = merchant;
  next();
}
