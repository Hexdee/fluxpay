import dotenv from "dotenv";
import path from "path";

dotenv.config();

const smtpEnabled = Boolean(
  process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_FROM,
);

const chainEnabled = Boolean(
  process.env.RPC_URL &&
    process.env.CHAIN_ID &&
    process.env.USDT0_ADDRESS &&
    process.env.PAYMENT_PROCESSOR_ADDRESS &&
    process.env.SIGNER_PRIVATE_KEY,
);

const faucetEnabled = Boolean(
  process.env.FAUCET_ENABLED === "true" || process.env.FAUCET_PRIVATE_KEY,
);

export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 4000,
  webOrigin: process.env.WEB_ORIGIN || "http://localhost:3000",
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:4000",
  checkoutBaseUrl: process.env.CHECKOUT_BASE_URL || "http://localhost:3000",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/fluxpay",
  docsPath: process.env.DOCS_PATH || path.join(process.cwd(), "..", "docs"),
  rpcUrl: process.env.RPC_URL || "",
  chainId: process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : 0,
  usdt0Address: process.env.USDT0_ADDRESS || "",
  paymentProcessorAddress: process.env.PAYMENT_PROCESSOR_ADDRESS || "",
  signerPrivateKey: process.env.SIGNER_PRIVATE_KEY || "",
  chainEnabled,
  faucetEnabled,
  faucetPrivateKey: process.env.FAUCET_PRIVATE_KEY || "",
  faucetAmount: process.env.FAUCET_AMOUNT ? Number(process.env.FAUCET_AMOUNT) : 250,
  faucetCooldownSeconds: process.env.FAUCET_COOLDOWN_SECONDS
    ? Number(process.env.FAUCET_COOLDOWN_SECONDS)
    : 24 * 60 * 60,
  webhookTimeoutMs: process.env.WEBHOOK_TIMEOUT_MS ? Number(process.env.WEBHOOK_TIMEOUT_MS) : 5000,
  webhookRetryBaseMs: process.env.WEBHOOK_RETRY_BASE_MS ? Number(process.env.WEBHOOK_RETRY_BASE_MS) : 2000,
  webhookRetryMaxAttempts: process.env.WEBHOOK_RETRY_MAX_ATTEMPTS
    ? Number(process.env.WEBHOOK_RETRY_MAX_ATTEMPTS)
    : 5,
  sessionTtlMs: process.env.SESSION_TTL_HOURS
    ? Number(process.env.SESSION_TTL_HOURS) * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000,
  webhookTimestampToleranceSeconds: process.env.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
    ? Number(process.env.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS)
    : 300,
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  // If SMTP_SECURE is not provided, default based on port (465 = implicit TLS).
  smtpSecure: process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) === 465 : false),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "",
  smtpSendTimeoutMs: process.env.SMTP_SEND_TIMEOUT_MS
    ? Number(process.env.SMTP_SEND_TIMEOUT_MS)
    : 4500,
  smtpEnabled,
  exposeDevAuthCodes: process.env.EXPOSE_DEV_AUTH_CODES
    ? process.env.EXPOSE_DEV_AUTH_CODES === "true"
    : (!smtpEnabled && process.env.NODE_ENV !== "production"),
};
