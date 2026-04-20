#!/usr/bin/env node
/**
 * Create a FluxPay API key via the backend API using merchant email + password.
 *
 * Usage:
 *   node scripts/create-api-key.mjs --api http://localhost:4000 --email you@x.com --password '...' --label "My Key" --scopes payments:read,payments:write
 *
 * Notes:
 * - This prints the created secret to stdout. Treat your terminal logs as sensitive.
 */

import process from "node:process";

function usage(message) {
  if (message) {
    console.error(message);
    console.error("");
  }
  console.error("Usage:");
  console.error(
    "  node scripts/create-api-key.mjs --api <apiBaseUrl> --email <email> --password <password> --label <label> [--environment Live] [--scopes a,b,c] [--json]",
  );
  console.error("");
  console.error("Examples:");
  console.error(
    "  node scripts/create-api-key.mjs --api http://localhost:4000 --email merchant@example.com --password 'Password123' --label 'Demo key' --scopes payments:read,payments:write,webhooks:read",
  );
  process.exit(message ? 1 : 0);
}

function readArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function normalizeApiBase(value) {
  try {
    const url = new URL(value);
    // Preserve pathname if provided, but remove trailing slash for stable join.
    url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

const apiBase = normalizeApiBase(
  readArg("--api") || process.env.FLUXPAY_API_BASE_URL || "",
);
const email = (readArg("--email") || process.env.FLUXPAY_EMAIL || "").trim();
const password = readArg("--password") || process.env.FLUXPAY_PASSWORD || "";
const label = (readArg("--label") || "").trim();
const environment = (readArg("--environment") || "Live").trim();
const scopesRaw = (readArg("--scopes") || "payments:read,payments:write").trim();
const jsonOutput = hasFlag("--json");

if (!apiBase) usage("Missing or invalid --api (or FLUXPAY_API_BASE_URL).");
if (!email) usage("Missing --email (or FLUXPAY_EMAIL).");
if (!password) usage("Missing --password (or FLUXPAY_PASSWORD).");
if (!label) usage("Missing --label.");

const scopes = scopesRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!scopes.length) usage("At least one scope is required.");

async function jsonOrThrow(res) {
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object" && "error" in parsed
        ? JSON.stringify(parsed.error)
        : JSON.stringify(parsed);
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${detail}`);
  }
  return parsed;
}

async function main() {
  const loginUrl = new URL("/auth/login", apiBase).toString();
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const login = await jsonOrThrow(loginRes);

  const token = String(login.sessionToken || "");
  if (!token) {
    throw new Error("Login succeeded but did not return a sessionToken.");
  }

  const createUrl = new URL("/dashboard/api-keys", apiBase).toString();
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ label, environment, scopes }),
  });
  const created = await jsonOrThrow(createRes);

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(created, null, 2) + "\n");
    return;
  }

  console.log("");
  console.log("API key created");
  console.log(`- Merchant: ${login.email ?? email}`);
  console.log(`- Key ID: ${created.id ?? "unknown"}`);
  console.log(`- Label: ${created.label ?? label}`);
  console.log(`- Environment: ${created.environment ?? environment}`);
  console.log(`- Scopes: ${(created.scopes ?? scopes).join(", ")}`);

  if (created.revealedSecret) {
    console.log("");
    console.log("Secret (store this safely):");
    console.log(created.revealedSecret);
  } else {
    console.log("");
    console.log(
      "No secret returned. If this is intentional (hash-only mode), rotate the key from the dashboard to reveal a new one.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

