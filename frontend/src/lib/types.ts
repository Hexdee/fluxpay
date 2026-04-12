export type TrendTone = 'up' | 'flat' | 'warn';
export type IconName =
  | 'wallet'
  | 'check-circle'
  | 'chart-up'
  | 'bolt'
  | 'link'
  | 'currency'
  | 'clock'
  | 'warning';

export type Workspace = {
  id: number;
  name: string;
  slug: string;
  status: string;
  siteUrl: string;
  supportEmail: string;
  brandAccent: string;
};

export type CurrentUser = {
  id: number;
  name: string;
  initials: string;
  role: string;
  team: string;
  email: string;
};

export type MerchantProfile = {
  merchantId: string;
  email: string;
  name: string;
  walletAddress: string;
  webhookUrl: string | null;
  emailVerified: boolean;
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
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
};

export type StatMetric = {
  id: string;
  label: string;
  value: string;
  caption: string;
  trendLabel: string;
  trendTone: TrendTone;
  icon: IconName;
};

export type SummaryMetric = {
  id: string;
  label: string;
  value: string;
};

export type SeriesPoint = {
  label: string;
  value: number;
};

export type DashboardMetrics = {
  stats: StatMetric[];
  summary: SummaryMetric[];
  volumeSeries: SeriesPoint[];
};

export type TimelineEvent = {
  id: string;
  title: string;
  detail: string;
  at: string;
  tone: 'ok' | 'info' | 'warn';
};

export type PaymentStatus = 'succeeded' | 'pending' | 'expired' | 'failed' | 'refunded';

export type Payment = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  orderId: string;
  customerEmail: string;
  customerWallet: string;
  checkoutUrl: string;
  successUrl: string;
  createdAt: string;
  updatedAt: string;
  linkId?: string;
  settlementStatus: string;
  settlementUpdatedAt: string;
  webhookSummary: string;
  refundableAmount: number;
  timeline: TimelineEvent[];
};

export type PaymentLinkStatus = 'active' | 'draft' | 'paused';

export type PaymentLink = {
  id: string;
  slug: string;
  title: string;
  status: PaymentLinkStatus;
  amount: number;
  currency: string;
  visits: number;
  completedPayments: number;
  conversionRate: number;
  avgTimeToPay: string;
  updatedAt: string;
  url: string;
  successUrl: string;
  brandingLabel: string;
  type: 'fixed' | 'open';
};

export type ApiKeyStatus = 'active' | 'limited' | 'rotating';

export type ApiKey = {
  id: string;
  label: string;
  environment: 'Live' | 'Test' | 'Staging';
  createdAt: string;
  owner: string;
  status: ApiKeyStatus;
  lastRotatedAt: string;
  scopes: string[];
  prefix: string;
  revealedSecret: string | null;
  sunsetAt?: string;
};

export type WebhookEndpointStatus = 'healthy' | 'retrying' | 'paused';

export type WebhookEndpoint = {
  id: string;
  label: string;
  url: string;
  status: WebhookEndpointStatus;
  events: string[];
  retryCount: number;
  successRate: number;
  lastResponseCode: number;
  lastEventAt: string;
  secretLastRotatedAt: string;
  secret?: string;
};

export type WebhookHeader = {
  name: string;
  value: string;
};

export type WebhookAttempt = {
  id: string;
  at: string;
  statusCode: number;
  note: string;
};

export type WebhookEvent = {
  id: string;
  type: string;
  paymentId?: string;
  endpointId: string;
  status: 'delivered' | 'queued' | 'retrying';
  createdAt: string;
  deliveredAt: string | null;
  requestId: string;
  signature: 'valid' | 'invalid';
  payload: Record<string, unknown>;
  headers: WebhookHeader[];
  attempts: WebhookAttempt[];
  responseBody: string;
};

export type Refund = {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export type DocRecord = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  file: string;
};
