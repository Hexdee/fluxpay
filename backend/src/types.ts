export type PaymentStatus = "pending" | "succeeded" | "failed" | "expired";

export type Merchant = {
  merchantId: string;
  name: string;
  email: string;
  walletAddress: string;
  brandName: string;
  brandAccent: string;
  buttonStyle: "rounded" | "soft" | "sharp";
  checkoutTheme: "dark-header" | "light-minimal";
  defaultExpiryMinutes: number;
  receiptBehavior: "optional" | "always" | "disabled";
  redirectAfterPayment: boolean;
  showDescriptionOnCheckout: boolean;
  notifyPaymentCreated: boolean;
  notifyPaymentSucceeded: boolean;
  notifyPaymentFailed: boolean;
  notifyWebhookFailed: boolean;
  passwordHash: string;
  emailVerified: boolean;
  verificationCode: string | null;
  resetCode: string | null;
  resetCodeExpiresAt: string | null;
  apiKeyHash: string;
  webhookUrl: string | null;
  webhookSecret: string;
  createdAt: string;
};

export type MerchantSession = {
  id: string;
  merchantId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type Payment = {
  paymentId: string;
  merchantId: string;
  amount: string;
  currency: "USDT0";
  merchantOrderId: string | null;
  customerEmail: string | null;
  successUrl?: string | null;
  expiresAt: string;
  status: PaymentStatus;
  metadata: Record<string, unknown> | null;
  checkoutUrl: string;
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WebhookAttempt = {
  attemptId: string;
  at: string;
  delivered: boolean;
  statusCode: number | null;
  responseBody: string | null;
  error: string | null;
};

export type WebhookEvent = {
  id: string;
  merchantId: string;
  type: "payment.pending" | "payment.succeeded" | "payment.failed" | "payment.expired";
  createdAt: string;
  data: {
    paymentId: string;
    amount: string;
    currency: "USDT0";
    txHash: string | null;
  };
  attempts: WebhookAttempt[];
};

export type Store = {
  merchants: Merchant[];
  sessions: MerchantSession[];
  payments: Payment[];
  webhookEvents: WebhookEvent[];
  webhookJobs: WebhookJob[];
  faucetClaims?: Record<string, string>;
  dashboard: DashboardStore;
};

export type WebhookJobStatus = "queued" | "processing" | "delivered" | "failed";

export type WebhookJob = {
  id: string;
  eventId: string;
  merchantId: string;
  url: string;
  secret: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  status: WebhookJobStatus;
  lastError: string | null;
};

export type DashboardWorkspace = {
  id: number;
  name: string;
  slug: string;
  status: string;
  siteUrl: string;
  supportEmail: string;
  brandAccent: string;
};

export type DashboardCurrentUser = {
  id: number;
  name: string;
  initials: string;
  role: string;
  team: string;
  email: string;
};

export type DashboardNotification = {
  id: string;
  merchantId?: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
};

export type DashboardDashboardMetrics = Record<string, unknown>;
export type DashboardPayment = Record<string, unknown> & { id: string; merchantId?: string };
export type DashboardPaymentLink = Record<string, unknown> & { id: string; merchantId?: string };
export type DashboardApiKey = Record<string, unknown> & { id: string; merchantId?: string };
export type DashboardWebhookEndpoint = Record<string, unknown> & { id: string; merchantId?: string };
export type DashboardWebhookEvent = Record<string, unknown> & { id: string; merchantId?: string };
export type DashboardRefund = Record<string, unknown> & { id: string; merchantId?: string };
export type DashboardDoc = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  file: string;
};

export type DashboardStore = {
  workspace: DashboardWorkspace | null;
  currentUser: DashboardCurrentUser | null;
  notifications: DashboardNotification[];
  dashboardMetrics: DashboardDashboardMetrics | null;
  payments: DashboardPayment[];
  paymentLinks: DashboardPaymentLink[];
  apiKeys: DashboardApiKey[];
  webhookEndpoints: DashboardWebhookEndpoint[];
  webhookEvents: DashboardWebhookEvent[];
  refunds: DashboardRefund[];
  docs: DashboardDoc[];
};
