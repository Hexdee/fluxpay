import { Pool, type PoolClient } from "pg";
import { config } from "./config.js";
import type { DashboardStore, Store } from "./types.js";

function shouldUseDatabaseSsl(databaseUrl: string) {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.PGSSLMODE === "require") return true;
  if (databaseUrl.includes("sslmode=require")) return true;
  if (databaseUrl.includes(".render.com")) return true;
  // Most managed Postgres providers require TLS in production.
  return process.env.NODE_ENV === "production";
}

function databaseSslConfig() {
  const enabled = shouldUseDatabaseSsl(config.databaseUrl);
  if (!enabled) return undefined;

  const rejectUnauthorized =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false" ? false : true;

  return { rejectUnauthorized };
}

const emptyDashboard: DashboardStore = {
  workspace: null,
  currentUser: null,
  notifications: [],
  dashboardMetrics: null,
  payments: [],
  paymentLinks: [],
  apiKeys: [],
  webhookEndpoints: [],
  webhookEvents: [],
  refunds: [],
  docs: [],
};

const defaultStore: Store = {
  merchants: [],
  sessions: [],
  payments: [],
  webhookEvents: [],
  webhookJobs: [],
  faucetClaims: {},
  dashboard: emptyDashboard,
};

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: databaseSslConfig(),
});

let initPromise: Promise<void> | null = null;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeDashboard(raw: unknown): DashboardStore {
  if (!isObject(raw)) {
    return { ...emptyDashboard };
  }

  return {
    workspace: isObject(raw.workspace)
      ? (raw.workspace as DashboardStore["workspace"])
      : null,
    currentUser: isObject(raw.currentUser)
      ? (raw.currentUser as DashboardStore["currentUser"])
      : null,
    notifications: Array.isArray(raw.notifications)
      ? (raw.notifications as DashboardStore["notifications"])
      : [],
    dashboardMetrics: isObject(raw.dashboardMetrics)
      ? (raw.dashboardMetrics as DashboardStore["dashboardMetrics"])
      : null,
    payments: Array.isArray(raw.payments)
      ? (raw.payments as DashboardStore["payments"])
      : [],
    paymentLinks: Array.isArray(raw.paymentLinks)
      ? (raw.paymentLinks as DashboardStore["paymentLinks"])
      : [],
    apiKeys: Array.isArray(raw.apiKeys)
      ? (raw.apiKeys as DashboardStore["apiKeys"])
      : [],
    webhookEndpoints: Array.isArray(raw.webhookEndpoints)
      ? (raw.webhookEndpoints as DashboardStore["webhookEndpoints"])
      : [],
    webhookEvents: Array.isArray(raw.webhookEvents)
      ? (raw.webhookEvents as DashboardStore["webhookEvents"])
      : [],
    refunds: Array.isArray(raw.refunds)
      ? (raw.refunds as DashboardStore["refunds"])
      : [],
    docs: Array.isArray(raw.docs) ? (raw.docs as DashboardStore["docs"]) : [],
  };
}

function normalizeStore(raw: unknown): Store {
  if (!isObject(raw)) {
    return structuredClone(defaultStore);
  }

  const merchants = Array.isArray(raw.merchants)
    ? raw.merchants.map((merchant) => ({
        ...(merchant as Record<string, unknown>),
        brandName:
          typeof (merchant as Record<string, unknown>).brandName === "string"
            ? ((merchant as Record<string, unknown>).brandName as string)
            : typeof (merchant as Record<string, unknown>).name === "string"
              ? ((merchant as Record<string, unknown>).name as string)
              : "",
        brandAccent:
          typeof (merchant as Record<string, unknown>).brandAccent === "string"
            ? ((merchant as Record<string, unknown>).brandAccent as string)
            : "#10B981",
        buttonStyle:
          (merchant as Record<string, unknown>).buttonStyle === "soft" ||
          (merchant as Record<string, unknown>).buttonStyle === "sharp" ||
          (merchant as Record<string, unknown>).buttonStyle === "rounded"
            ? ((merchant as Record<string, unknown>).buttonStyle as
                | "rounded"
                | "soft"
                | "sharp")
            : "rounded",
        checkoutTheme:
          (merchant as Record<string, unknown>).checkoutTheme === "light-minimal" ||
          (merchant as Record<string, unknown>).checkoutTheme === "dark-header"
            ? ((merchant as Record<string, unknown>).checkoutTheme as
                | "dark-header"
                | "light-minimal")
            : "dark-header",
        defaultExpiryMinutes:
          typeof (merchant as Record<string, unknown>).defaultExpiryMinutes === "number" &&
          Number.isFinite((merchant as Record<string, unknown>).defaultExpiryMinutes as number)
            ? ((merchant as Record<string, unknown>).defaultExpiryMinutes as number)
            : 30,
        receiptBehavior:
          (merchant as Record<string, unknown>).receiptBehavior === "always" ||
          (merchant as Record<string, unknown>).receiptBehavior === "disabled" ||
          (merchant as Record<string, unknown>).receiptBehavior === "optional"
            ? ((merchant as Record<string, unknown>).receiptBehavior as
                | "optional"
                | "always"
                | "disabled")
            : "optional",
        redirectAfterPayment: Boolean(
          (merchant as Record<string, unknown>).redirectAfterPayment ?? true,
        ),
        showDescriptionOnCheckout: Boolean(
          (merchant as Record<string, unknown>).showDescriptionOnCheckout ?? true,
        ),
        notifyPaymentCreated: Boolean(
          (merchant as Record<string, unknown>).notifyPaymentCreated ?? true,
        ),
        notifyPaymentSucceeded: Boolean(
          (merchant as Record<string, unknown>).notifyPaymentSucceeded ?? true,
        ),
        notifyPaymentFailed: Boolean(
          (merchant as Record<string, unknown>).notifyPaymentFailed ?? true,
        ),
        notifyWebhookFailed: Boolean(
          (merchant as Record<string, unknown>).notifyWebhookFailed ?? true,
        ),
        passwordHash:
          typeof (merchant as Record<string, unknown>).passwordHash === "string"
            ? ((merchant as Record<string, unknown>).passwordHash as string)
            : "",
        walletAddress:
          typeof (merchant as Record<string, unknown>).walletAddress === "string"
            ? ((merchant as Record<string, unknown>).walletAddress as string)
            : "0x0000000000000000000000000000000000000000",
        emailVerified: Boolean(
          (merchant as Record<string, unknown>).emailVerified,
        ),
        verificationCode: ((merchant as Record<string, unknown>)
          .verificationCode ?? null) as string | null,
        resetCode: ((merchant as Record<string, unknown>).resetCode ??
          null) as string | null,
        resetCodeExpiresAt: ((merchant as Record<string, unknown>)
          .resetCodeExpiresAt ?? null) as string | null,
      })) as Store["merchants"]
    : [];

  return {
    merchants,
    sessions: Array.isArray(raw.sessions)
      ? (raw.sessions as Store["sessions"])
      : [],
    payments: Array.isArray(raw.payments)
      ? (raw.payments as Store["payments"])
      : [],
    webhookEvents: Array.isArray(raw.webhookEvents)
      ? (raw.webhookEvents as Store["webhookEvents"])
      : [],
    webhookJobs: Array.isArray(raw.webhookJobs)
      ? (raw.webhookJobs as Store["webhookJobs"])
      : [],
    faucetClaims: isObject((raw as Record<string, unknown>).faucetClaims)
      ? (((raw as Record<string, unknown>).faucetClaims as Record<string, unknown>) as Record<string, string>)
      : {},
    dashboard: normalizeDashboard(raw.dashboard),
  };
}

async function initializeDatabase() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          id SMALLINT PRIMARY KEY,
          version INTEGER NOT NULL,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        );
      `);

      await client.query(
        `
          INSERT INTO schema_migrations(version, applied_at)
          VALUES (1, NOW())
          ON CONFLICT (version) DO NOTHING
        `,
      );

      await client.query(
        `
          INSERT INTO app_state(id, version, payload, updated_at)
          VALUES (1, 1, $1::jsonb, NOW())
          ON CONFLICT (id) DO NOTHING
        `,
        [JSON.stringify(defaultStore)],
      );
    } finally {
      client.release();
    }
  })();

  return initPromise;
}

async function readStoreWithClient(client: PoolClient): Promise<Store> {
  const result = await client.query<{ payload: unknown }>(
    `SELECT payload FROM app_state WHERE id = 1`,
  );
  const payload = result.rows[0]?.payload ?? defaultStore;
  return normalizeStore(payload);
}

export async function readStore(): Promise<Store> {
  await initializeDatabase();
  const client = await pool.connect();
  try {
    return await readStoreWithClient(client);
  } finally {
    client.release();
  }
}

export async function mutateStore<T>(
  mutator: (store: Store) => T,
): Promise<T> {
  await initializeDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM app_state WHERE id = 1 FOR UPDATE`);
    const current = await readStoreWithClient(client);
    const result = mutator(current);

    await client.query(
      `
        UPDATE app_state
        SET payload = $1::jsonb,
            version = version + 1,
            updated_at = NOW()
        WHERE id = 1
      `,
      [JSON.stringify(current)],
    );
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
