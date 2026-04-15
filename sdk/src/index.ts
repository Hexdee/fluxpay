import crypto from 'crypto';

const BASE_URL = 'https://fluxpay-7f5a.onrender.com';

export type CheckoutClientOptions = {
  apiKey?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
};

export type CreatePaymentInput = {
  amount: string;
  currency: 'USDT0';
  customerEmail: string;
  merchantOrderId?: string;
  successUrl?: string;
  expiresInMinutes?: number;
  metadata?: Record<string, unknown>;
};

export type CreatePaymentResponse = {
  paymentId: string;
  status: 'pending' | 'succeeded' | 'failed' | 'expired';
  checkoutUrl: string;
  onchain: {
    token: 'USDT0';
    amount: string;
  };
};

export type SignupInput = {
  name: string;
  email: string;
  password?: string;
  walletAddress?: string;
  webhookUrl?: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type Payment = {
  paymentId: string;
  status: 'pending' | 'succeeded' | 'failed' | 'expired';
  amount: string;
  currency: 'USDT0';
  merchantOrderId: string | null;
  successUrl: string | null;
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
  checkoutUrl: string;
  onchain: {
    token: 'USDT0';
    amount: string;
  };
};

export type WebhookEvent = {
  id: string;
  type:
    | 'payment.pending'
    | 'payment.succeeded'
    | 'payment.failed'
    | 'payment.expired';
  createdAt: string;
  data: {
    paymentId: string;
    amount: string;
    currency: 'USDT0';
    txHash: string | null;
  };
};

export class CheckoutApiError extends Error {
  status: number;
  body: string | null;

  constructor(message: string, status: number, body: string | null) {
    super(message);
    this.name = 'CheckoutApiError';
    this.status = status;
    this.body = body;
  }
}

export class CheckoutClient {
  private apiKey: string | null;
  private timeoutMs: number;
  private fetchFn: typeof fetch;
  private headers: Record<string, string>;

  constructor(options?: CheckoutClientOptions) {
    this.apiKey = options?.apiKey ?? null;
    this.timeoutMs = options?.timeoutMs ?? 10000;
    this.fetchFn = options?.fetch ?? fetch;
    this.headers = options?.headers ?? {};
  }

  private requireApiKey() {
    if (!this.apiKey) {
      throw new Error(
        'Missing apiKey. Create a CheckoutClient with { apiKey } for this request.',
      );
    }
    return this.apiKey;
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
    opts?: { auth?: 'apiKey' | 'none' },
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const auth = opts?.auth ?? 'apiKey';

    try {
      const apiKey = auth === 'apiKey' ? this.requireApiKey() : null;
      const response = await this.fetchFn(`${BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          ...this.headers,
          ...(init?.headers ?? {}),
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let message = text || `Request failed: ${response.status}`;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed?.error) message = parsed.error;
        } catch {
          // ignore non-JSON errors
        }
        throw new CheckoutApiError(message, response.status, text || null);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  payments = {
    create: (input: CreatePaymentInput) =>
      this.request<CreatePaymentResponse>(
        '/payments',
        {
          method: 'POST',
          body: JSON.stringify({
            ...input,
            // Backend defaults to 30 minutes if omitted, but being explicit keeps behavior stable.
            expiresInMinutes: input.expiresInMinutes ?? 30,
          }),
        },
        { auth: 'apiKey' },
      ),

    get: (id: string) =>
      this.request<Payment>(`/payments/${id}`, undefined, { auth: 'apiKey' }),

    listByMerchant: (merchantId: string) =>
      this.request<{ items: Payment[] }>(
        `/merchants/${merchantId}/payments`,
        undefined,
        { auth: 'apiKey' },
      ),

    // Dev-only helper exposed by the MVP backend.
    simulateSucceeded: (id: string) =>
      this.request<Payment>(
        `/payments/${id}/simulate-succeeded`,
        { method: 'POST' },
        { auth: 'apiKey' },
      ),
  };

  webhooks = {
    test: () =>
      this.request<{
        ok: boolean;
        eventId: string;
        delivered: boolean;
        statusCode: number | null;
        error: string | null;
      }>('/webhooks/test', { method: 'POST' }, { auth: 'apiKey' }),
  };

  auth = {
    signup: (input: SignupInput) =>
      this.request<{
        merchantId: string;
        apiKey: string;
        webhookSecret: string;
        sessionToken: string;
        sessionExpiresAt: string;
        verificationEmailSent: boolean;
        devVerificationCode?: string;
      }>(
        '/auth/signup',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
        { auth: 'none' },
      ),
    login: (input: LoginInput) =>
      this.request<{
        merchantId: string;
        email: string;
        name: string;
        apiKeyHint: string;
        sessionToken: string;
        sessionExpiresAt: string;
      }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
        { auth: 'none' },
      ),
  };
}

export function verifyWebhook(params: {
  rawBody: string;
  signature: string | string[] | undefined;
  timestamp: string | string[] | undefined;
  secret: string;
  toleranceSeconds?: number;
  now?: number | Date;
}): WebhookEvent {
  if (!params.signature || Array.isArray(params.signature)) {
    throw new Error('Missing signature');
  }

  if (!params.timestamp || Array.isArray(params.timestamp)) {
    throw new Error('Missing signature timestamp');
  }

  const nowMs =
    params.now instanceof Date
      ? params.now.getTime()
      : typeof params.now === 'number'
        ? params.now
        : Date.now();
  const toleranceSeconds = params.toleranceSeconds ?? 300;
  const timestampSeconds = Number(params.timestamp);

  if (!Number.isFinite(timestampSeconds)) {
    throw new Error('Invalid signature timestamp');
  }

  const age = Math.abs(nowMs - timestampSeconds * 1000);
  if (age > toleranceSeconds * 1000) {
    throw new Error('Signature timestamp outside tolerated replay window');
  }

  const signedPayload = `${params.timestamp}.${params.rawBody}`;
  const expected = crypto
    .createHmac('sha256', params.secret)
    .update(signedPayload)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(params.signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid signature');
  }

  return JSON.parse(params.rawBody) as WebhookEvent;
}
