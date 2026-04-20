import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { config } from './config.js';
import {
  authenticateMerchant,
  createSessionToken,
  getMerchantByEmail,
  requireApiKey,
  requireSession,
} from './auth.js';
import { mutateStore, readStore } from './db.js';
import {
  paymentProcessorInterface,
  provider as chainProvider,
} from './chain.js';
import { Contract, Wallet, parseUnits } from 'ethers';
import { buildEvent, buildWebhookJob, deliverWebhook } from './webhook.js';
import {
  hashMetadata,
  hashPaymentId,
  signIntent,
  toBaseUnits,
  type PaymentIntent,
} from './intent.js';
import {
  isEmailDeliveryEnabled,
  sendCustomerPaymentCreatedEmail,
  sendCustomerPaymentReceiptEmail,
  sendMerchantPaymentSucceededEmail,
  sendPasswordResetCodeEmail,
  sendVerificationCodeEmail,
} from './mailer.js';
import {
  entityId,
  hashPassword,
  randomNumericCode,
  randomToken,
  sha256Hex,
} from './utils.js';
import type {
  DashboardApiKey,
  DashboardPayment,
  DashboardPaymentLink,
  DashboardRefund,
  DashboardWebhookEndpoint,
  DashboardWebhookEvent,
  Merchant,
  Payment,
  Store,
} from './types.js';
import type { AuthedRequest } from './auth.js';

const app = express();

app.use(cors({ origin: config.webOrigin }));
app.use(express.json());

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  walletAddress: z.string().min(8).optional(),
  webhookUrl: z.string().url().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
  password: z.string().min(8),
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
});

const createPaymentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.literal('USDT0'),
  customerEmail: z.string().email(),
  merchantOrderId: z.string().optional(),
  successUrl: z.string().url().optional(),
  expiresInMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(1440)
    .optional()
    .default(30),
  metadata: z.record(z.unknown()).optional(),
});

const checkoutConfirmSchema = z.object({
  walletAddress: z.string().min(8).optional(),
  txHash: z.string().min(8).optional(),
  outcome: z.enum(['succeeded', 'failed']).optional(),
});

const publicLinkCheckoutSchema = z.object({
  amount: z.union([z.number(), z.string()]).optional(),
  merchantOrderId: z.string().optional(),
  customerEmail: z.string().email().optional(),
});

function checkoutUrlFor(paymentId: string) {
  return `${config.checkoutBaseUrl.replace(/\/$/, '')}/checkout?paymentId=${paymentId}`;
}

function serializePayment(payment: Payment) {
  return {
    paymentId: payment.paymentId,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    merchantOrderId: payment.merchantOrderId,
    successUrl:
      asString((payment as Record<string, unknown>).successUrl).trim() || null,
    txHash: payment.txHash,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    expiresAt: payment.expiresAt,
    checkoutUrl: payment.checkoutUrl,
    onchain: {
      token: payment.currency,
      amount: payment.amount,
    },
  };
}

function queryValue(input: unknown): string | undefined {
  if (typeof input === 'string') return input;
  if (Array.isArray(input) && typeof input[0] === 'string') return input[0];
  return undefined;
}

function sortRows<T extends Record<string, unknown>>(
  items: T[],
  query: Record<string, unknown>,
) {
  const sortBy = queryValue(query._sort);
  const order = queryValue(query._order) === 'desc' ? 'desc' : 'asc';

  if (!sortBy) return items;

  const sorted = [...items].sort((a, b) => {
    const left = a[sortBy];
    const right = b[sortBy];

    if (left === right) return 0;
    if (left === undefined || left === null) return order === 'asc' ? -1 : 1;
    if (right === undefined || right === null) return order === 'asc' ? 1 : -1;

    const leftString = String(left).toLowerCase();
    const rightString = String(right).toLowerCase();
    return order === 'asc'
      ? leftString.localeCompare(rightString)
      : rightString.localeCompare(leftString);
  });

  return sorted;
}

function findDashboardPaymentLinkBySlug(store: Store, slug: string) {
  const normalized = slug.trim().toLowerCase();
  return store.dashboard.paymentLinks.find(
    (entry) => asString(entry.slug).trim().toLowerCase() === normalized,
  );
}

function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function isConfiguredWalletAddress(value: unknown) {
  const address = asString(value).trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) return false;
  if (address === '0x0000000000000000000000000000000000000000') return false;
  return true;
}

type MerchantScopedRow = {
  id: string;
  merchantId?: string;
  [key: string]: unknown;
};

function asMerchantScopedRows<T extends MerchantScopedRow>(
  rows: T[],
  merchantId: string,
) {
  return rows.filter((row) => row.merchantId === merchantId);
}

function stripMerchantScope<T extends MerchantScopedRow>(row: T) {
  const { merchantId: _merchantId, ...rest } = row;
  return rest as Omit<T, 'merchantId'>;
}

function withMerchantScope<T extends Record<string, unknown>>(
  row: T,
  merchantId: string,
) {
  return {
    ...row,
    merchantId,
  };
}

function asNumber(value: unknown, fallback = 0) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeCheckoutStatus(value: unknown): Payment['status'] {
  if (
    value === 'pending' ||
    value === 'succeeded' ||
    value === 'failed' ||
    value === 'expired'
  ) {
    return value;
  }

  if (value === 'refunded') {
    return 'succeeded';
  }

  return 'pending';
}

function checkoutPaymentIdFromUrl(value: unknown) {
  const raw = asString(value).trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw, config.checkoutBaseUrl);
    return parsed.searchParams.get('paymentId');
  } catch {
    return null;
  }
}

function toDashboardWebhookAttempts(
  attempts: Array<{
    attemptId: string;
    at: string;
    statusCode: number | null;
    delivered: boolean;
    error: string | null;
  }>,
) {
  return [...attempts].reverse().map((attempt) => ({
    id: attempt.attemptId,
    at: attempt.at,
    statusCode: attempt.statusCode ?? (attempt.delivered ? 200 : 0),
    note:
      attempt.error ??
      (attempt.delivered ? 'Delivered successfully.' : 'Delivery failed.'),
  }));
}

function dashboardWebhookStatusFromCore(
  event: Store['webhookEvents'][number],
): 'queued' | 'retrying' | 'delivered' {
  if (!event.attempts.length) return 'queued';
  const latest = event.attempts[event.attempts.length - 1];
  if (latest?.delivered) return 'delivered';
  return 'retrying';
}

function buildDashboardWebhookEventFromCore(
  event: Store['webhookEvents'][number],
  endpointId: string,
) {
  const status = dashboardWebhookStatusFromCore(event);
  const deliveredAttempt = [...event.attempts]
    .reverse()
    .find((item) => item.delivered);
  const latestAttempt =
    event.attempts.length > 0
      ? event.attempts[event.attempts.length - 1]
      : null;

  return withMerchantScope(
    {
      id: event.id,
      type: event.type,
      paymentId: event.data.paymentId,
      endpointId,
      status,
      createdAt: event.createdAt,
      deliveredAt: deliveredAttempt?.at ?? null,
      requestId: `req_${event.id}`,
      signature: 'valid',
      payload: {
        id: event.id,
        type: event.type,
        createdAt: event.createdAt,
        data: event.data,
      },
      headers: [
        { name: 'content-type', value: 'application/json' },
        { name: 'x-signature', value: 'generated' },
      ],
      attempts: toDashboardWebhookAttempts(event.attempts),
      responseBody: latestAttempt?.responseBody ?? latestAttempt?.error ?? '',
    },
    event.merchantId,
  );
}

function activeDashboardWebhookEndpointId(store: Store, merchantId: string) {
  const merchant = store.merchants.find(
    (entry) => entry.merchantId === merchantId,
  );
  const activeUrl = asString(merchant?.webhookUrl).trim();
  if (activeUrl) {
    const match = store.dashboard.webhookEndpoints.find(
      (entry) =>
        asString(entry.merchantId) === merchantId &&
        asString((entry as Record<string, unknown>).url).trim() === activeUrl,
    );
    if (match) return asString(match.id) || 'endpoint_default';
  }

  const fallback =
    store.dashboard.webhookEndpoints.find(
      (entry) => asString(entry.merchantId) === merchantId,
    )?.id ?? 'endpoint_default';
  return asString(fallback) || 'endpoint_default';
}

function successUrlForCheckoutPayment(store: Store, checkoutPaymentId: string) {
  const corePayment = store.payments.find((entry) => {
    const id = asString(entry.paymentId);
    if (id === checkoutPaymentId) return true;
    return checkoutPaymentIdFromUrl(entry.checkoutUrl) === checkoutPaymentId;
  });
  const coreSuccess = asString(
    (corePayment as Record<string, unknown> | null)?.successUrl,
  ).trim();
  if (coreSuccess) return coreSuccess;

  const dashboardPayment = store.dashboard.payments.find((entry) => {
    const id = asString(entry.id);
    if (id === checkoutPaymentId) {
      return true;
    }
    return checkoutPaymentIdFromUrl(entry.checkoutUrl) === checkoutPaymentId;
  });

  const successUrl = asString(dashboardPayment?.successUrl).trim();
  return successUrl || null;
}

function findDashboardPaymentByCheckoutId(
  store: Store,
  checkoutPaymentId: string,
  merchantId?: string,
) {
  return store.dashboard.payments.find((entry) => {
    const matchesId =
      asString(entry.id) === checkoutPaymentId ||
      checkoutPaymentIdFromUrl(entry.checkoutUrl) === checkoutPaymentId;
    if (!matchesId) return false;
    if (!merchantId) return true;
    return asString(entry.merchantId) === merchantId;
  });
}

function prependDashboardTimelineEvent(
  payment: DashboardPayment,
  event: {
    title: string;
    detail: string;
    at: string;
    tone: 'ok' | 'info' | 'warn';
  },
) {
  const existing = Array.isArray(payment.timeline)
    ? (payment.timeline as Array<Record<string, unknown>>)
    : [];

  const duplicate = existing.some(
    (item) =>
      asString(item.title) === event.title &&
      asString(item.detail) === event.detail,
  );
  if (duplicate) {
    payment.timeline = existing;
    return;
  }

  payment.timeline = [
    {
      id: entityId('timeline'),
      title: event.title,
      detail: event.detail,
      at: event.at,
      tone: event.tone,
    },
    ...existing,
  ];
}

function markDashboardPaymentSucceeded(
  payment: DashboardPayment,
  at: string,
  txHash: string | null,
) {
  const amount = asNumber(payment.amount, 0);
  const refundableAmount = asNumber(payment.refundableAmount, 0);
  payment.status = 'succeeded';
  payment.updatedAt = at;
  payment.txHash = txHash;
  payment.settlementStatus = 'Completed';
  payment.settlementUpdatedAt = at;
  payment.webhookSummary = 'payment.succeeded queued';
  if (refundableAmount <= 0 && amount > 0) {
    payment.refundableAmount = amount;
  }
  prependDashboardTimelineEvent(payment, {
    title: 'Payment completed',
    detail:
      'Customer payment confirmed successfully and settlement has been marked complete.',
    at,
    tone: 'ok',
  });
}

function markDashboardPaymentExpired(payment: DashboardPayment, at: string) {
  payment.status = 'expired';
  payment.updatedAt = at;
  payment.settlementStatus = 'Expired';
  payment.settlementUpdatedAt = at;
  payment.webhookSummary = 'payment.expired queued';
  prependDashboardTimelineEvent(payment, {
    title: 'Payment expired',
    detail:
      'Checkout session expired before confirmation. A new payment request is required.',
    at,
    tone: 'warn',
  });
}

function markDashboardPaymentFailed(payment: DashboardPayment, at: string) {
  payment.status = 'failed';
  payment.updatedAt = at;
  payment.settlementStatus = 'Failed';
  payment.settlementUpdatedAt = at;
  payment.webhookSummary = 'payment.failed queued';
  prependDashboardTimelineEvent(payment, {
    title: 'Payment failed',
    detail:
      'Customer attempted payment but it could not be completed. Retry or request a new payment.',
    at,
    tone: 'warn',
  });
}

function formatDurationMinutesSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function paymentCompletionAt(payment: DashboardPayment) {
  const timeline = Array.isArray(payment.timeline)
    ? (payment.timeline as Array<Record<string, unknown>>)
    : [];
  const completedEvent = timeline.find(
    (entry) => asString(entry.title).toLowerCase() === 'payment completed',
  );
  const fromTimeline = asString(completedEvent?.at).trim();
  if (fromTimeline) {
    return fromTimeline;
  }

  const settlementStatus = asString(payment.settlementStatus).toLowerCase();
  const settlementUpdatedAt = asString(payment.settlementUpdatedAt).trim();
  if (settlementStatus === 'completed' && settlementUpdatedAt) {
    return settlementUpdatedAt;
  }

  if (asString(payment.status).toLowerCase() === 'succeeded') {
    const updatedAt = asString(payment.updatedAt).trim();
    return updatedAt || null;
  }

  return null;
}

function recomputePaymentLinkMetrics(store: Store, link: DashboardPaymentLink) {
  const linkId = asString(link.id);
  const merchantId = asString(link.merchantId);
  if (!linkId || !merchantId) return;

  const relatedPayments = store.dashboard.payments.filter(
    (payment) =>
      asString(payment.merchantId) === merchantId &&
      asString(payment.linkId) === linkId,
  );

  const completedPayments = relatedPayments.filter((payment) => {
    const status = asString(payment.status).toLowerCase();
    return status === 'succeeded' || status === 'refunded';
  }).length;

  const checkoutStarts = relatedPayments.length;
  const completionSeconds = relatedPayments
    .map((payment) => {
      const completedAt = paymentCompletionAt(payment);
      const createdAt = asString(payment.createdAt).trim();
      if (!completedAt || !createdAt) return null;
      const diffSeconds =
        (new Date(completedAt).getTime() - new Date(createdAt).getTime()) /
        1000;
      if (!Number.isFinite(diffSeconds) || diffSeconds < 0) return null;
      return diffSeconds;
    })
    .filter((value): value is number => typeof value === 'number');

  // "visits" represents page views for the hosted pay page. To avoid
  // nonsensical conversion > 100% during migration / missing view pings,
  // keep it at least as large as checkout starts.
  const visits = Math.max(
    asNumber(link.visits, 0),
    checkoutStarts,
    completedPayments,
  );
  const averageSeconds = completionSeconds.length
    ? completionSeconds.reduce((sum, seconds) => sum + seconds, 0) /
      completionSeconds.length
    : 0;

  link.completedPayments = completedPayments;
  link.visits = visits;
  link.conversionRate = visits
    ? Number(((completedPayments / visits) * 100).toFixed(2))
    : 0;
  link.avgTimeToPay =
    completionSeconds.length > 0
      ? formatDurationMinutesSeconds(averageSeconds)
      : asString(link.avgTimeToPay, '0m 00s');
}

function markPaymentLinkCompletion(store: Store, payment: DashboardPayment) {
  const linkId = asString(payment.linkId);
  if (!linkId) return;

  const link = store.dashboard.paymentLinks.find(
    (entry) =>
      asString(entry.id) === linkId &&
      asString(entry.merchantId) === asString(payment.merchantId),
  );
  if (!link) return;

  recomputePaymentLinkMetrics(store, link);
  link.updatedAt = asString(payment.updatedAt, new Date().toISOString());
}

function withLifecycleTimelineBackfill(
  payment: DashboardPayment,
): DashboardPayment {
  const copy: DashboardPayment = {
    ...payment,
    timeline: Array.isArray(payment.timeline)
      ? [...(payment.timeline as Array<Record<string, unknown>>)]
      : [],
  };

  const status = asString(copy.status).toLowerCase();
  const updatedAt = asString(copy.updatedAt, new Date().toISOString());

  if (status === 'succeeded') {
    if (asNumber(copy.refundableAmount, 0) <= 0) {
      copy.refundableAmount = asNumber(copy.amount, 0);
    }
    prependDashboardTimelineEvent(copy, {
      title: 'Payment completed',
      detail:
        'Customer payment confirmed successfully and settlement has been marked complete.',
      at: updatedAt,
      tone: 'ok',
    });
  } else if (status === 'expired') {
    prependDashboardTimelineEvent(copy, {
      title: 'Payment expired',
      detail:
        'Checkout session expired before confirmation. A new payment request is required.',
      at: updatedAt,
      tone: 'warn',
    });
  } else if (status === 'refunded') {
    prependDashboardTimelineEvent(copy, {
      title: 'Payment refunded',
      detail: 'Refund processed and merchant ledger updated.',
      at: updatedAt,
      tone: 'warn',
    });
  }

  return copy;
}

function monthLabel(date: Date) {
  return date.toLocaleString('en-US', { month: 'short' });
}

function buildDashboardMetrics(
  payments: DashboardPayment[],
  links: DashboardPaymentLink[],
  endpoints: DashboardWebhookEndpoint[],
) {
  const paymentTotal = payments.reduce((total, entry) => {
    const amount = Number(entry.amount ?? 0);
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);

  const succeeded = payments.filter((entry) => entry.status === 'succeeded');
  const activeLinks = links.filter((entry) => entry.status === 'active');
  const healthyEndpoints = endpoints.filter(
    (entry) => entry.status === 'healthy',
  );

  const timeline = Array.from({ length: 12 }).map((_, index) => {
    const pointDate = new Date();
    pointDate.setMonth(pointDate.getMonth() - (11 - index));
    const label = monthLabel(pointDate);

    const monthTotal = payments
      .filter((entry) => {
        const updatedAt = String(entry.updatedAt ?? '');
        if (!updatedAt) return false;
        const date = new Date(updatedAt);
        return (
          date.getFullYear() === pointDate.getFullYear() &&
          date.getMonth() === pointDate.getMonth()
        );
      })
      .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);

    return {
      label,
      raw: monthTotal,
    };
  });

  const maxMonth = Math.max(1, ...timeline.map((entry) => entry.raw));
  const volumeSeries = timeline.map((entry) => ({
    label: entry.label,
    value: Math.round((entry.raw / maxMonth) * 100),
  }));

  return {
    stats: [
      {
        id: 'volume',
        label: 'Total volume',
        value: `${paymentTotal.toFixed(2)} USDT0`,
        caption: 'All tracked payments',
        trendLabel: `${payments.length} payment${payments.length === 1 ? '' : 's'}`,
        trendTone: 'up',
        icon: 'currency',
      },
      {
        id: 'succeeded',
        label: 'Succeeded',
        value: String(succeeded.length),
        caption: 'Confirmed settlements',
        trendLabel: succeeded.length ? 'Healthy' : 'No activity',
        trendTone: succeeded.length ? 'up' : 'flat',
        icon: 'check-circle',
      },
      {
        id: 'active-links',
        label: 'Active links',
        value: String(activeLinks.length),
        caption: 'Checkout links accepting payments',
        trendLabel: activeLinks.length ? 'Live' : 'None active',
        trendTone: activeLinks.length ? 'up' : 'warn',
        icon: 'link',
      },
      {
        id: 'endpoint-health',
        label: 'Webhook health',
        value: endpoints.length
          ? `${Math.round((healthyEndpoints.length / endpoints.length) * 100)}%`
          : '--',
        caption: 'Healthy delivery endpoints',
        trendLabel: endpoints.length ? 'Delivery monitored' : 'No endpoints',
        trendTone: endpoints.length ? 'flat' : 'warn',
        icon: 'bolt',
      },
    ],
    summary: [
      {
        id: 'gross',
        label: 'Gross volume',
        value: `${paymentTotal.toFixed(2)} USDT0`,
      },
      {
        id: 'orders',
        label: 'Orders',
        value: String(payments.length),
      },
      {
        id: 'success-rate',
        label: 'Success rate',
        value: payments.length
          ? `${Math.round((succeeded.length / payments.length) * 100)}%`
          : '--',
      },
    ],
    volumeSeries,
  };
}

function summaryFromMarkdown(markdown: string) {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const summaryLine = lines.find((line) => !line.startsWith('#'));
  return summaryLine ?? 'Documentation reference';
}

async function readDocsCatalog() {
  const docsRoot = path.isAbsolute(config.docsPath)
    ? config.docsPath
    : path.resolve(process.cwd(), config.docsPath);
  let files: string[] = [];
  try {
    files = await fs.readdir(docsRoot);
  } catch {
    return [] as Array<{
      id: string;
      title: string;
      slug: string;
      summary: string;
      file: string;
    }>;
  }

  const markdownFiles = files.filter((file) => file.endsWith('.md')).sort();
  const docs = await Promise.all(
    markdownFiles.map(async (file) => {
      const slug = file.replace(/\.md$/, '');
      const raw = await fs.readFile(path.join(docsRoot, file), 'utf8');
      const heading = raw
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('# '));
      const title =
        heading?.replace(/^#\s+/, '').trim() ||
        slug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
      return {
        id: slug,
        title,
        slug,
        summary: summaryFromMarkdown(raw),
        file,
      };
    }),
  );

  return docs;
}

async function queueEventForMerchant(
  eventType:
    | 'payment.pending'
    | 'payment.succeeded'
    | 'payment.failed'
    | 'payment.expired',
  payment: Payment,
  merchant: Merchant,
) {
  const event = buildEvent(eventType, payment);

  await mutateStore((store) => {
    store.webhookEvents.push(event);

    const defaultEndpointId = activeDashboardWebhookEndpointId(
      store,
      merchant.merchantId,
    );
    const dashboardEvent = buildDashboardWebhookEventFromCore(
      event,
      defaultEndpointId,
    );
    const existingDashboardEvent = store.dashboard.webhookEvents.find(
      (entry) =>
        asString(entry.id) === dashboardEvent.id &&
        asString(entry.merchantId) === merchant.merchantId,
    );
    if (existingDashboardEvent) {
      Object.assign(existingDashboardEvent, dashboardEvent);
    } else {
      store.dashboard.webhookEvents.unshift(dashboardEvent);
    }

    if (merchant.webhookUrl) {
      store.webhookJobs.push(
        buildWebhookJob({
          eventId: event.id,
          merchantId: merchant.merchantId,
          url: merchant.webhookUrl,
          secret: merchant.webhookSecret,
          maxAttempts: config.webhookRetryMaxAttempts,
        }),
      );
    }
  });

  return event;
}

let processingJobs = false;

async function processWebhookJobs() {
  if (processingJobs) return;
  processingJobs = true;

  try {
    const snapshot = await readStore();
    const now = Date.now();

    const dueJobs = snapshot.webhookJobs
      .filter(
        (job) =>
          job.status === 'queued' &&
          new Date(job.nextAttemptAt).getTime() <= now,
      )
      .slice(0, 8);

    for (const dueJob of dueJobs) {
      const claimed = await mutateStore((store) => {
        const job = store.webhookJobs.find((entry) => entry.id === dueJob.id);
        if (!job || job.status !== 'queued') return false;
        job.status = 'processing';
        return true;
      });

      if (!claimed) continue;

      const latestStore = await readStore();
      const job = latestStore.webhookJobs.find(
        (entry) => entry.id === dueJob.id,
      );
      const event = latestStore.webhookEvents.find(
        (entry) => entry.id === dueJob.eventId,
      );

      if (!job || !event) {
        await mutateStore((store) => {
          const stale = store.webhookJobs.find(
            (entry) => entry.id === dueJob.id,
          );
          if (stale) {
            stale.status = 'failed';
            stale.lastError = 'Event record not found';
          }
        });
        continue;
      }

      const attempt = await deliverWebhook({
        url: job.url,
        event,
        secret: job.secret,
        timeoutMs: config.webhookTimeoutMs,
      });

      await mutateStore((store) => {
        const jobRef = store.webhookJobs.find((entry) => entry.id === job.id);
        const eventRef = store.webhookEvents.find(
          (entry) => entry.id === job.eventId,
        );
        const dashboardEventRef = store.dashboard.webhookEvents.find(
          (entry) =>
            asString(entry.id) === job.eventId &&
            asString(entry.merchantId) === job.merchantId,
        );
        if (!jobRef || !eventRef) return;

        eventRef.attempts.push(attempt);
        jobRef.attempts += 1;

        if (dashboardEventRef) {
          const existingAttempts = Array.isArray(dashboardEventRef.attempts)
            ? (dashboardEventRef.attempts as Array<Record<string, unknown>>)
            : [];
          dashboardEventRef.attempts = [
            {
              id: attempt.attemptId,
              at: attempt.at,
              statusCode: attempt.statusCode ?? (attempt.delivered ? 200 : 0),
              note:
                attempt.error ??
                (attempt.delivered
                  ? 'Delivered successfully.'
                  : `HTTP ${attempt.statusCode ?? 'unknown'}`),
            },
            ...existingAttempts,
          ];
          dashboardEventRef.responseBody =
            attempt.responseBody ??
            attempt.error ??
            asString(dashboardEventRef.responseBody);
          dashboardEventRef.status = attempt.delivered
            ? 'delivered'
            : 'retrying';
          if (attempt.delivered) {
            dashboardEventRef.deliveredAt = attempt.at;
          }
        }

        if (attempt.delivered) {
          jobRef.status = 'delivered';
          jobRef.lastError = null;
          return;
        }

        if (jobRef.attempts >= jobRef.maxAttempts) {
          jobRef.status = 'failed';
          jobRef.lastError =
            attempt.error ?? `HTTP ${attempt.statusCode ?? 'unknown'}`;
          return;
        }

        const delay = config.webhookRetryBaseMs * 2 ** (jobRef.attempts - 1);
        jobRef.status = 'queued';
        jobRef.lastError =
          attempt.error ?? `HTTP ${attempt.statusCode ?? 'unknown'}`;
        jobRef.nextAttemptAt = new Date(Date.now() + delay).toISOString();
      });
    }
  } finally {
    processingJobs = false;
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'fluxpay-checkout-backend' });
});

app.post('/auth/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const payload = parsed.data;

  const existing = await getMerchantByEmail(payload.email);
  if (existing) {
    res.status(409).json({ error: 'Merchant with this email already exists.' });
    return;
  }

  const merchantId = entityId('mch');
  const apiKey = randomToken('sk');
  const webhookSecret = randomToken('whsec');
  const verificationCode = randomNumericCode(6);

  const merchant: Merchant = {
    merchantId,
    name: payload.name,
    email: payload.email,
    walletAddress:
      payload.walletAddress ?? '0x0000000000000000000000000000000000000000',
    brandName: payload.name,
    brandAccent: '#10B981',
    buttonStyle: 'rounded',
    checkoutTheme: 'dark-header',
    defaultExpiryMinutes: 30,
    receiptBehavior: 'optional',
    redirectAfterPayment: true,
    showDescriptionOnCheckout: true,
    notifyPaymentCreated: true,
    notifyPaymentSucceeded: true,
    notifyPaymentFailed: true,
    notifyWebhookFailed: true,
    passwordHash: hashPassword(payload.password ?? randomToken('pwd')),
    emailVerified: false,
    verificationCode,
    resetCode: null,
    resetCodeExpiresAt: null,
    apiKeyHash: sha256Hex(apiKey),
    webhookUrl: payload.webhookUrl ?? null,
    webhookSecret,
    createdAt: new Date().toISOString(),
  };

  await mutateStore((store) => {
    store.merchants.push(merchant);
  });

  const session = await createSessionToken(merchantId);
  const verificationEmailSent = await sendVerificationCodeEmail({
    to: merchant.email,
    name: merchant.name,
    code: verificationCode,
  });
  // If email delivery fails, return the code so the user isn't blocked in dev/test.
  const includeDevCode = config.exposeDevAuthCodes || !verificationEmailSent;

  res.status(201).json({
    merchantId,
    apiKey,
    webhookSecret,
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
    verificationEmailSent,
    ...(includeDevCode ? { devVerificationCode: verificationCode } : {}),
  });
});

app.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const merchant = await authenticateMerchant(
    parsed.data.email,
    parsed.data.password,
  );
  if (!merchant) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const session = await createSessionToken(merchant.merchantId);

  res.json({
    merchantId: merchant.merchantId,
    email: merchant.email,
    name: merchant.name,
    apiKeyHint: `sk_****${merchant.apiKeyHash.slice(-6)}`,
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
  });
});

app.get('/auth/me', requireSession, async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchant = authedReq.merchant;
  if (!merchant) {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }

  res.json({
    merchantId: merchant.merchantId,
    email: merchant.email,
    name: merchant.name,
    walletAddress: merchant.walletAddress,
    webhookUrl: merchant.webhookUrl,
    emailVerified: merchant.emailVerified,
    brandName: merchant.brandName,
    brandAccent: merchant.brandAccent,
    buttonStyle: merchant.buttonStyle,
    checkoutTheme: merchant.checkoutTheme,
    defaultExpiryMinutes: merchant.defaultExpiryMinutes,
    receiptBehavior: merchant.receiptBehavior,
    redirectAfterPayment: merchant.redirectAfterPayment,
    showDescriptionOnCheckout: merchant.showDescriptionOnCheckout,
    notifyPaymentCreated: merchant.notifyPaymentCreated,
    notifyPaymentSucceeded: merchant.notifyPaymentSucceeded,
    notifyPaymentFailed: merchant.notifyPaymentFailed,
    notifyWebhookFailed: merchant.notifyWebhookFailed,
  });
});

app.patch('/auth/me', requireSession, async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchant = authedReq.merchant;
  if (!merchant) {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }

  const schema = z.object({
    walletAddress: z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => (typeof value === 'string' ? value.trim() : value)),
    brandName: z.string().min(2).max(80).optional(),
    brandAccent: z
      .string()
      .regex(/^#([0-9a-fA-F]{6})$/)
      .optional(),
    buttonStyle: z.enum(['rounded', 'soft', 'sharp']).optional(),
    checkoutTheme: z.enum(['dark-header', 'light-minimal']).optional(),
    defaultExpiryMinutes: z.coerce.number().int().min(1).max(1440).optional(),
    receiptBehavior: z.enum(['optional', 'always', 'disabled']).optional(),
    redirectAfterPayment: z.coerce.boolean().optional(),
    showDescriptionOnCheckout: z.coerce.boolean().optional(),
    notifyPaymentCreated: z.coerce.boolean().optional(),
    notifyPaymentSucceeded: z.coerce.boolean().optional(),
    notifyPaymentFailed: z.coerce.boolean().optional(),
    notifyWebhookFailed: z.coerce.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const wallet = parsed.data.walletAddress;
  if (wallet !== undefined && wallet !== null) {
    const normalized = wallet.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
      res
        .status(400)
        .json({ error: 'Wallet address must be a valid 0x address.' });
      return;
    }
    if (
      normalized.toLowerCase() === '0x0000000000000000000000000000000000000000'
    ) {
      res
        .status(400)
        .json({ error: 'Wallet address cannot be the zero address.' });
      return;
    }
  }

  const updated = await mutateStore((store) => {
    const current = store.merchants.find(
      (entry) => entry.merchantId === merchant.merchantId,
    );
    if (!current) return null;

    if (wallet !== undefined) {
      current.walletAddress =
        wallet === null ? '0x0000000000000000000000000000000000000000' : wallet;
    }

    if (parsed.data.brandName !== undefined)
      current.brandName = parsed.data.brandName;
    if (parsed.data.brandAccent !== undefined)
      current.brandAccent = parsed.data.brandAccent;
    if (parsed.data.buttonStyle !== undefined)
      current.buttonStyle = parsed.data.buttonStyle;
    if (parsed.data.checkoutTheme !== undefined)
      current.checkoutTheme = parsed.data.checkoutTheme;
    if (parsed.data.defaultExpiryMinutes !== undefined)
      current.defaultExpiryMinutes = parsed.data.defaultExpiryMinutes;
    if (parsed.data.receiptBehavior !== undefined)
      current.receiptBehavior = parsed.data.receiptBehavior;
    if (parsed.data.redirectAfterPayment !== undefined)
      current.redirectAfterPayment = parsed.data.redirectAfterPayment;
    if (parsed.data.showDescriptionOnCheckout !== undefined)
      current.showDescriptionOnCheckout = parsed.data.showDescriptionOnCheckout;
    if (parsed.data.notifyPaymentCreated !== undefined)
      current.notifyPaymentCreated = parsed.data.notifyPaymentCreated;
    if (parsed.data.notifyPaymentSucceeded !== undefined)
      current.notifyPaymentSucceeded = parsed.data.notifyPaymentSucceeded;
    if (parsed.data.notifyPaymentFailed !== undefined)
      current.notifyPaymentFailed = parsed.data.notifyPaymentFailed;
    if (parsed.data.notifyWebhookFailed !== undefined)
      current.notifyWebhookFailed = parsed.data.notifyWebhookFailed;

    return {
      merchantId: current.merchantId,
      email: current.email,
      name: current.name,
      walletAddress: current.walletAddress,
      webhookUrl: current.webhookUrl,
      emailVerified: current.emailVerified,
      brandName: current.brandName,
      brandAccent: current.brandAccent,
      buttonStyle: current.buttonStyle,
      checkoutTheme: current.checkoutTheme,
      defaultExpiryMinutes: current.defaultExpiryMinutes,
      receiptBehavior: current.receiptBehavior,
      redirectAfterPayment: current.redirectAfterPayment,
      showDescriptionOnCheckout: current.showDescriptionOnCheckout,
      notifyPaymentCreated: current.notifyPaymentCreated,
      notifyPaymentSucceeded: current.notifyPaymentSucceeded,
      notifyPaymentFailed: current.notifyPaymentFailed,
      notifyWebhookFailed: current.notifyWebhookFailed,
    };
  });

  if (!updated) {
    res.status(404).json({ error: 'Merchant not found.' });
    return;
  }

  res.json(updated);
});

app.post('/auth/forgot-password', async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const code = randomNumericCode(6);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const target = await mutateStore((store) => {
    const merchant = store.merchants.find(
      (entry) => entry.email.toLowerCase() === parsed.data.email.toLowerCase(),
    );
    if (!merchant) return null;
    merchant.resetCode = code;
    merchant.resetCodeExpiresAt = expiresAt;
    return {
      email: merchant.email,
      name: merchant.name,
    };
  });
  let resetEmailSent = false;
  if (target) {
    resetEmailSent = await sendPasswordResetCodeEmail({
      to: target.email,
      name: target.name,
      code,
    });
  }
  const includeDevCode = config.exposeDevAuthCodes || !resetEmailSent;

  res.json({
    ok: true,
    message: 'If the account exists, a reset code has been generated.',
    ...(includeDevCode ? { devCode: code } : {}),
  });
});

app.post('/auth/reset-password', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, code, password } = parsed.data;

  const result = await mutateStore((store) => {
    const merchant = store.merchants.find(
      (entry) => entry.email.toLowerCase() === email.toLowerCase(),
    );
    if (!merchant) return { ok: false, reason: 'invalid' as const };

    if (!merchant.resetCode || !merchant.resetCodeExpiresAt) {
      return { ok: false, reason: 'invalid' as const };
    }

    if (merchant.resetCode !== code) {
      return { ok: false, reason: 'invalid' as const };
    }

    if (new Date(merchant.resetCodeExpiresAt).getTime() < Date.now()) {
      return { ok: false, reason: 'expired' as const };
    }

    merchant.passwordHash = hashPassword(password);
    merchant.resetCode = null;
    merchant.resetCodeExpiresAt = null;
    return { ok: true as const };
  });

  if (!result.ok) {
    res
      .status(result.reason === 'expired' ? 410 : 400)
      .json({ error: 'Invalid or expired reset code.' });
    return;
  }

  res.json({ ok: true });
});

app.post('/auth/verify-email', async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const verifiedMerchantId = await mutateStore((store) => {
    const merchant = store.merchants.find(
      (entry) => entry.email.toLowerCase() === parsed.data.email.toLowerCase(),
    );
    if (!merchant) return null;

    if (merchant.emailVerified) {
      return merchant.merchantId;
    }

    if (
      !merchant.verificationCode ||
      merchant.verificationCode !== parsed.data.code
    ) {
      return null;
    }

    merchant.emailVerified = true;
    merchant.verificationCode = null;
    return merchant.merchantId;
  });

  if (!verifiedMerchantId) {
    res.status(400).json({ error: 'Invalid verification code.' });
    return;
  }

  const session = await createSessionToken(verifiedMerchantId);
  res.json({
    ok: true,
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
    merchantId: verifiedMerchantId,
  });
});

app.post('/payments', requireApiKey, async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  if (!isConfiguredWalletAddress(authedReq.merchant.walletAddress)) {
    res
      .status(409)
      .json({
        error:
          'Add a payout wallet address to your profile before creating payments.',
      });
    return;
  }
  const parsed = createPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const payload = parsed.data;
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + payload.expiresInMinutes * 60 * 1000,
  );
  const paymentId = entityId('pay');
  const customerEmail = payload.customerEmail.trim().toLowerCase();

  const payment: Payment = {
    paymentId,
    merchantId: authedReq.merchant.merchantId,
    amount: payload.amount,
    currency: payload.currency,
    merchantOrderId: payload.merchantOrderId ?? null,
    customerEmail,
    successUrl: payload.successUrl?.trim() || null,
    expiresAt: expiresAt.toISOString(),
    status: 'pending',
    metadata: payload.metadata ?? null,
    checkoutUrl: checkoutUrlFor(paymentId),
    txHash: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await mutateStore((store) => {
    store.payments.push(payment);
  });

  await queueEventForMerchant('payment.pending', payment, authedReq.merchant);

  // Best-effort: email the hosted checkout link to the customer.
  void sendCustomerPaymentCreatedEmail({
    to: customerEmail,
    merchantName: authedReq.merchant.name,
    amount: payment.amount,
    currency: payment.currency,
    orderId: payment.merchantOrderId,
    paymentId: payment.paymentId,
    checkoutUrl: payment.checkoutUrl,
  });

  res.status(201).json({
    paymentId: payment.paymentId,
    status: payment.status,
    checkoutUrl: payment.checkoutUrl,
    onchain: {
      token: payment.currency,
      amount: payment.amount,
    },
  });
});

app.get('/payments/:id', requireApiKey, async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const store = await readStore();
  const payment = store.payments.find(
    (entry) => entry.paymentId === req.params.id,
  );

  if (!payment) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }

  if (payment.merchantId !== authedReq.merchant.merchantId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  res.json(serializePayment(payment));
});

app.get('/merchants/:id/payments', requireApiKey, async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  if (req.params.id !== authedReq.merchant.merchantId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const store = await readStore();
  const items = store.payments
    .filter((payment) => payment.merchantId === authedReq.merchant.merchantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(serializePayment);

  res.json({ items });
});

app.post(
  '/payments/:id/simulate-succeeded',
  requireApiKey,
  async (req, res) => {
    const authedReq = req as unknown as AuthedRequest;
    const paymentId = req.params.id;
    const now = new Date().toISOString();

    const outcome = await mutateStore((store) => {
      const payment = store.payments.find(
        (entry) => entry.paymentId === paymentId,
      );
      if (!payment) {
        return {
          status: 404 as const,
          payload: { error: 'Payment not found' },
        };
      }
      if (payment.merchantId !== authedReq.merchant.merchantId) {
        return { status: 403 as const, payload: { error: 'Forbidden' } };
      }

      const previousStatus = payment.status;
      if (payment.status !== 'succeeded') {
        payment.status = 'succeeded';
        payment.txHash = entityId('tx');
        payment.updatedAt = now;
        const dashboardPayment = findDashboardPaymentByCheckoutId(
          store,
          payment.paymentId,
          payment.merchantId,
        );
        if (dashboardPayment) {
          markDashboardPaymentSucceeded(dashboardPayment, now, payment.txHash);
          markPaymentLinkCompletion(store, dashboardPayment);
        }
      }

      return {
        status: 200 as const,
        payload: serializePayment(payment),
        payment,
        transitioned: previousStatus !== payment.status,
      };
    });

    if (
      'payment' in outcome &&
      outcome.payment &&
      'transitioned' in outcome &&
      outcome.transitioned
    ) {
      await queueEventForMerchant('payment.succeeded', outcome.payment, authedReq.merchant);

      const to = asString(outcome.payment.customerEmail).trim();
      if (
        to &&
        z.string().email().safeParse(to).success &&
        !to.toLowerCase().endsWith('@checkout.local')
      ) {
        void sendCustomerPaymentReceiptEmail({
          to,
          merchantName: authedReq.merchant.name,
          status: 'succeeded',
          amount: outcome.payment.amount,
          currency: outcome.payment.currency,
          orderId: outcome.payment.merchantOrderId,
          paymentId: outcome.payment.paymentId,
          txHash: outcome.payment.txHash,
        });
      }

      if (authedReq.merchant.notifyPaymentSucceeded) {
        void sendMerchantPaymentSucceededEmail({
          to: authedReq.merchant.email,
          merchantName: authedReq.merchant.name,
          amount: outcome.payment.amount,
          currency: outcome.payment.currency,
          orderId: outcome.payment.merchantOrderId,
          paymentId: outcome.payment.paymentId,
          customerEmail: outcome.payment.customerEmail,
          txHash: outcome.payment.txHash,
          dashboardUrl: `${config.webOrigin.replace(/\/$/, '')}/payments/detail?id=${outcome.payment.paymentId}`,
        });
      }
    }

    res.status(outcome.status).json(outcome.payload);
  },
);

app.post('/webhooks/test', requireApiKey, async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;

  if (!authedReq.merchant.webhookUrl) {
    res.status(400).json({ error: 'Merchant has no webhook URL configured.' });
    return;
  }

  const now = new Date().toISOString();
  const payment: Payment = {
    paymentId: entityId('pay'),
    merchantId: authedReq.merchant.merchantId,
    amount: '25.00',
    currency: 'USDT0',
    merchantOrderId: entityId('order'),
    customerEmail: null,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    status: 'pending',
    metadata: { source: 'webhook_test' },
    checkoutUrl: checkoutUrlFor(entityId('pay')),
    txHash: null,
    createdAt: now,
    updatedAt: now,
  };

  const event = await queueEventForMerchant(
    'payment.pending',
    payment,
    authedReq.merchant,
  );

  res.json({
    ok: true,
    queued: true,
    eventId: event.id,
  });
});

app.get('/webhooks/events', requireApiKey, async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const store = await readStore();

  const items = store.webhookEvents
    .filter((event) => event.merchantId === authedReq.merchant.merchantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({ items });
});

app.get('/public/faucet', async (_req, res) => {
  res.json({
    enabled: config.faucetEnabled && config.chainId === 71,
    chainId: config.chainId,
    tokenAddress: config.usdt0Address || null,
    amount: config.faucetAmount,
    decimals: 6,
    cooldownSeconds: config.faucetCooldownSeconds,
    explorerBaseUrl:
      config.chainId === 71
        ? 'https://evmtestnet.confluxscan.org'
        : 'https://evm.confluxscan.org',
  });
});

app.post('/public/faucet', async (req, res) => {
  const schema = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  if (!config.faucetEnabled || config.chainId !== 71) {
    res.status(403).json({ error: 'Faucet is not enabled.' });
    return;
  }

  if (!config.usdt0Address || !chainProvider) {
    res.status(500).json({ error: 'Chain provider is not configured.' });
    return;
  }

  const recipient = parsed.data.address.toLowerCase();
  const now = new Date().toISOString();
  const store = await readStore();
  const last = store.faucetClaims?.[recipient] ?? null;
  if (last) {
    const diffSeconds = (Date.now() - new Date(last).getTime()) / 1000;
    if (
      Number.isFinite(diffSeconds) &&
      diffSeconds < config.faucetCooldownSeconds
    ) {
      res.status(429).json({
        error: 'Faucet already claimed recently. Please try again later.',
        nextEligibleAt: new Date(
          new Date(last).getTime() + config.faucetCooldownSeconds * 1000,
        ).toISOString(),
      });
      return;
    }
  }

  const faucetKey = config.faucetPrivateKey || config.signerPrivateKey;
  if (!faucetKey) {
    res.status(500).json({ error: 'Faucet signer is not configured.' });
    return;
  }

  try {
    const wallet = new Wallet(faucetKey, chainProvider);
    const token = new Contract(
      config.usdt0Address,
      ['function mint(address to, uint256 amount)'],
      wallet,
    );

    const amount = parseUnits(String(config.faucetAmount), 6);
    const tx = await token.mint(parsed.data.address, amount);
    const receipt = await tx.wait(1);

    await mutateStore((inner) => {
      inner.faucetClaims = inner.faucetClaims ?? {};
      inner.faucetClaims[recipient] = now;
    });

    res.json({
      ok: true,
      to: parsed.data.address,
      amount: config.faucetAmount,
      decimals: 6,
      tokenAddress: config.usdt0Address,
      txHash: receipt?.hash ?? tx.hash,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to mint tokens.',
    });
  }
});

app.get('/public/payment-links/:slug', async (req, res) => {
  const store = await readStore();
  const link = findDashboardPaymentLinkBySlug(store, req.params.slug);

  if (!link) {
    res.status(404).json({ error: 'Payment link not found' });
    return;
  }

  const merchant = store.merchants.find(
    (entry) => entry.merchantId === asString(link.merchantId),
  );

  res.json({
    id: asString(link.id),
    slug: asString(link.slug),
    title: asString(link.title, 'Checkout'),
    status: asString(link.status, 'draft'),
    type: asString(link.type, 'fixed'),
    currency: asString(link.currency, 'USDT0'),
    amount:
      asString(link.type, 'fixed') === 'open' ? null : asNumber(link.amount, 0),
    successUrl: asString(link.successUrl) || null,
    merchantName: merchant?.name ?? 'Merchant',
  });
});

app.post('/public/payment-links/:slug/view', async (req, res) => {
  const now = new Date().toISOString();
  const store = await readStore();
  const link = findDashboardPaymentLinkBySlug(store, req.params.slug);

  if (!link) {
    res.status(404).json({ error: 'Payment link not found' });
    return;
  }

  await mutateStore((innerStore) => {
    const target = findDashboardPaymentLinkBySlug(innerStore, req.params.slug);
    if (!target) return;
    target.visits = asNumber(target.visits, 0) + 1;
    target.updatedAt = now;
  });

  res.json({ ok: true });
});

app.post('/public/payment-links/:slug/checkout', async (req, res) => {
  const parsed = publicLinkCheckoutSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const now = new Date().toISOString();
  const store = await readStore();
  const link = findDashboardPaymentLinkBySlug(store, req.params.slug);

  if (!link) {
    res.status(404).json({ error: 'Payment link not found' });
    return;
  }

  if (asString(link.status) !== 'active') {
    res.status(409).json({ error: 'Payment link is not active.' });
    return;
  }

  const merchantId = asString(link.merchantId);
  const merchant = store.merchants.find(
    (entry) => entry.merchantId === merchantId,
  );
  if (!merchant) {
    res.status(500).json({ error: 'Payment link merchant is not available.' });
    return;
  }
  if (!isConfiguredWalletAddress(merchant.walletAddress)) {
    res
      .status(409)
      .json({
        error:
          'Merchant payout wallet is not configured for this payment link.',
      });
    return;
  }

  const type = asString(link.type, 'fixed');
  const requestedAmount = asNumber(parsed.data.amount, 0);
  const amountNumber =
    type === 'open' ? requestedAmount : asNumber(link.amount, 0);
  if (amountNumber <= 0) {
    res.status(400).json({
      error:
        type === 'open'
          ? 'Amount is required for open amount payment links.'
          : 'Payment link amount is invalid.',
    });
    return;
  }

  const paymentId = entityId('pay');
  const checkoutUrl = checkoutUrlFor(paymentId);
  const orderId =
    asString(parsed.data.merchantOrderId).trim() || entityId('order');
  // Only set if the merchant explicitly configured one.
  const successUrl = asString(link.successUrl).trim() || null;
  const customerEmail =
    asString(parsed.data.customerEmail).trim() || 'guest@checkout.local';

  const payment: Payment = {
    paymentId,
    merchantId,
    amount: amountNumber.toFixed(2),
    currency: 'USDT0',
    merchantOrderId: orderId,
    customerEmail,
    successUrl,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    status: 'pending',
    metadata: {
      source: 'payment_link',
      linkId: asString(link.id),
      slug: asString(link.slug),
    },
    checkoutUrl,
    txHash: null,
    createdAt: now,
    updatedAt: now,
  };

  await mutateStore((innerStore) => {
    innerStore.payments.push(payment);
    innerStore.dashboard.payments.unshift(
      withMerchantScope(
        {
          id: paymentId,
          title: asString(link.title, 'Payment link checkout'),
          amount: amountNumber,
          currency: asString(link.currency, 'USDT0'),
          status: 'pending',
          orderId,
          customerEmail,
          customerWallet: 'Pending wallet signature',
          checkoutUrl,
          successUrl,
          createdAt: now,
          updatedAt: now,
          linkId: asString(link.id),
          settlementStatus: 'Awaiting payment',
          settlementUpdatedAt: now,
          webhookSummary: 'payment.pending queued',
          refundableAmount: 0,
          timeline: [
            {
              id: entityId('timeline'),
              title: 'Payment created',
              detail: 'Checkout session created from a hosted payment link.',
              at: now,
              tone: 'ok',
            },
          ],
        },
        merchantId,
      ),
    );

    const targetLink = innerStore.dashboard.paymentLinks.find(
      (entry) =>
        asString(entry.id) === asString(link.id) &&
        asString(entry.merchantId) === merchantId,
    );
    if (targetLink) {
      targetLink.updatedAt = now;
    }
  });

  await queueEventForMerchant('payment.pending', payment, merchant);

  res.status(201).json({
    paymentId,
    checkoutUrl,
  });
});

app.get('/checkout/payments/:id', async (req, res) => {
  const store = await readStore();
  const payment = store.payments.find(
    (entry) => entry.paymentId === req.params.id,
  );

  if (!payment) {
    const legacyPayment = store.dashboard.payments.find(
      (entry) => checkoutPaymentIdFromUrl(entry.checkoutUrl) === req.params.id,
    );
    if (!legacyPayment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    const merchant = store.merchants.find(
      (entry) => entry.merchantId === asString(legacyPayment.merchantId),
    );
    const expiresAt = asString(
      legacyPayment.expiresAt,
      new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    );
    const createdAt = asString(
      legacyPayment.createdAt,
      new Date().toISOString(),
    );
    const status =
      normalizeCheckoutStatus(legacyPayment.status) === 'pending' &&
      new Date(expiresAt).getTime() <= Date.now()
        ? 'expired'
        : normalizeCheckoutStatus(legacyPayment.status);

    res.json({
      paymentId: req.params.id,
      amount: asNumber(legacyPayment.amount, 0).toFixed(2),
      currency: asString(legacyPayment.currency, 'USDT0'),
      merchantOrderId: asString(legacyPayment.orderId).trim() || null,
      status,
      expiresAt,
      createdAt,
      updatedAt: asString(legacyPayment.updatedAt, createdAt),
      txHash: asString(legacyPayment.txHash) || null,
      merchantName: merchant?.name ?? 'Merchant',
      successUrl: asString(legacyPayment.successUrl).trim() || null,
    });
    return;
  }

  if (
    payment.status === 'pending' &&
    new Date(payment.expiresAt).getTime() <= Date.now()
  ) {
    await mutateStore((innerStore) => {
      const item = innerStore.payments.find(
        (entry) => entry.paymentId === payment.paymentId,
      );
      if (item && item.status === 'pending') {
        item.status = 'expired';
        item.updatedAt = new Date().toISOString();
        const dashboardPayment = findDashboardPaymentByCheckoutId(
          innerStore,
          item.paymentId,
          item.merchantId,
        );
        if (dashboardPayment) {
          markDashboardPaymentExpired(dashboardPayment, item.updatedAt);
        }
      }
    });
    payment.status = 'expired';
  }

  const merchant = store.merchants.find(
    (entry) => entry.merchantId === payment.merchantId,
  );

  let chain: {
    chainId: number;
    usdt0Address: string;
    paymentProcessorAddress: string;
  } | null = null;
  let paymentIntent: PaymentIntent | null = null;
  let paymentSignature: string | null = null;

  if (config.chainEnabled && merchant?.walletAddress) {
    try {
      chain = {
        chainId: config.chainId,
        usdt0Address: config.usdt0Address,
        paymentProcessorAddress: config.paymentProcessorAddress,
      };
      paymentIntent = {
        paymentId: hashPaymentId(payment.paymentId),
        merchant: merchant.walletAddress,
        amount: await toBaseUnits(payment.amount),
        expiresAt: Math.floor(new Date(payment.expiresAt).getTime() / 1000),
        metadataHash: hashMetadata(payment.metadata),
      };
      paymentSignature = await signIntent(paymentIntent);
    } catch (error) {
      console.warn('Unable to build onchain intent', error);
      chain = null;
      paymentIntent = null;
      paymentSignature = null;
    }
  }

  res.json({
    paymentId: payment.paymentId,
    amount: payment.amount,
    currency: payment.currency,
    merchantOrderId: payment.merchantOrderId,
    status: payment.status,
    expiresAt: payment.expiresAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    txHash: payment.txHash,
    merchantName: merchant?.name ?? 'Merchant',
    successUrl: successUrlForCheckoutPayment(store, payment.paymentId),
    chain,
    paymentIntent,
    paymentSignature,
  });
});

app.post('/checkout/payments/:id/confirm', async (req, res) => {
  const parsed = checkoutConfirmSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const paymentId = req.params.id;
  const now = new Date().toISOString();
  const requestedTxHash = asString(parsed.data.txHash).trim() || null;
  const desiredOutcome = requestedTxHash
    ? 'succeeded'
    : (parsed.data.outcome ?? 'succeeded');

  // If the client provides a txHash, verify it (best-effort) and persist it on success.
  // This keeps the flow simple while still allowing a real onchain path.
  let verifiedTxHash: string | null = requestedTxHash;
  let verifiedPayer: string | null =
    asString(parsed.data.walletAddress).trim() || null;

  if (requestedTxHash && config.chainEnabled && chainProvider) {
    try {
      const store = await readStore();
      const payment =
        store.payments.find((entry) => entry.paymentId === paymentId) ?? null;
      const merchant = payment
        ? (store.merchants.find(
            (entry) => entry.merchantId === payment.merchantId,
          ) ?? null)
        : null;

      if (!payment || !merchant) {
        // fallback: handled by existing legacy logic below
      } else {
        const receipt =
          await chainProvider.getTransactionReceipt(requestedTxHash);
        if (!receipt) {
          res.status(400).json({ error: 'Transaction not found.' });
          return;
        }

        if (receipt.status !== 1) {
          res.status(400).json({ error: 'Transaction failed.' });
          return;
        }

        const expectedPaymentHash = hashPaymentId(paymentId);
        const expectedMerchant = merchant.walletAddress.toLowerCase();

        const matching = receipt.logs
          .map((log) => {
            try {
              return paymentProcessorInterface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((parsedLog) => {
            if (!parsedLog) return false;
            if (parsedLog.name !== 'PaymentCompleted') return false;
            const paymentHash = String(parsedLog.args.paymentId).toLowerCase();
            const merchantAddr = String(parsedLog.args.merchant).toLowerCase();
            return (
              paymentHash === expectedPaymentHash.toLowerCase() &&
              merchantAddr === expectedMerchant
            );
          });

        if (!matching) {
          res
            .status(400)
            .json({ error: 'Transaction does not match this payment.' });
          return;
        }

        verifiedPayer = String(matching.args.payer);
        verifiedTxHash = requestedTxHash;
      }
    } catch (error) {
      console.warn(
        'Onchain verification failed; falling back to trusting txHash',
        error,
      );
    }
  }

  const outcome = await mutateStore((store) => {
    const payment = store.payments.find(
      (entry) => entry.paymentId === paymentId,
    );
    if (!payment) {
      const legacyPayment = store.dashboard.payments.find(
        (entry) => checkoutPaymentIdFromUrl(entry.checkoutUrl) === paymentId,
      );
      if (!legacyPayment) {
        return {
          status: 404 as const,
          payload: { error: 'Payment not found' },
        };
      }

      const legacyCreatedAt = asString(legacyPayment.createdAt, now);
      const legacyExpiresAt = asString(
        legacyPayment.expiresAt,
        new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      );
      const legacyStatus = normalizeCheckoutStatus(legacyPayment.status);
      const legacySuccessUrl =
        asString(legacyPayment.successUrl).trim() || null;
      const serializedLegacy = {
        paymentId,
        status: legacyStatus,
        amount: asNumber(legacyPayment.amount, 0).toFixed(2),
        currency: asString(legacyPayment.currency, 'USDT0'),
        merchantOrderId: asString(legacyPayment.orderId).trim() || null,
        txHash: asString(legacyPayment.txHash) || null,
        createdAt: legacyCreatedAt,
        updatedAt: asString(legacyPayment.updatedAt, legacyCreatedAt),
        expiresAt: legacyExpiresAt,
        checkoutUrl: `${config.checkoutBaseUrl.replace(/\/$/, '')}/checkout?paymentId=${paymentId}`,
        successUrl: legacySuccessUrl,
        onchain: {
          token: 'USDT0',
          amount: asNumber(legacyPayment.amount, 0).toFixed(2),
        },
      };

      if (legacyStatus === 'succeeded') {
        markDashboardPaymentSucceeded(
          legacyPayment,
          asString(legacyPayment.updatedAt, now),
          asString(legacyPayment.txHash) || null,
        );
        return {
          status: 200 as const,
          payload: serializedLegacy,
        };
      }

      if (
        legacyStatus === 'expired' ||
        new Date(legacyExpiresAt).getTime() <= Date.now()
      ) {
        markDashboardPaymentExpired(legacyPayment, now);
        return { status: 410 as const, payload: { error: 'Payment expired' } };
      }

      markDashboardPaymentSucceeded(
        legacyPayment,
        now,
        asString(legacyPayment.txHash) || null,
      );
      markPaymentLinkCompletion(store, legacyPayment);

      return {
        status: 200 as const,
        payload: {
          ...serializedLegacy,
          status: 'succeeded',
          updatedAt: now,
        },
      };
    }

    const dashboardPayment = findDashboardPaymentByCheckoutId(
      store,
      paymentId,
      payment.merchantId,
    );
    const previousStatus = payment.status;

    if (
      payment.status === 'expired' ||
      new Date(payment.expiresAt).getTime() <= Date.now()
    ) {
      if (payment.status !== 'expired') {
        payment.status = 'expired';
        payment.updatedAt = now;
        if (dashboardPayment) {
          markDashboardPaymentExpired(dashboardPayment, now);
        }
      }
      return {
        status: 410 as const,
        payload: { error: 'Payment expired' },
        payment,
        merchantId: payment.merchantId,
        finalStatus: payment.status,
        transitioned: previousStatus !== payment.status,
      };
    }

    if (payment.status === 'succeeded') {
      if (dashboardPayment) {
        markDashboardPaymentSucceeded(
          dashboardPayment,
          payment.updatedAt,
          payment.txHash,
        );
      }
      const successUrl = successUrlForCheckoutPayment(store, paymentId);
      return {
        status: 200 as const,
        payload: {
          ...serializePayment(payment),
          successUrl,
        },
        payment,
        merchantId: payment.merchantId,
        finalStatus: payment.status,
        transitioned: false,
      };
    }

    if (desiredOutcome === 'failed') {
      payment.status = 'failed';
      payment.txHash = null;
      payment.updatedAt = now;
      if (dashboardPayment) {
        markDashboardPaymentFailed(dashboardPayment, now);
      }
      return {
        status: 200 as const,
        payload: {
          ...serializePayment(payment),
          successUrl: null,
        },
        payment,
        merchantId: payment.merchantId,
        finalStatus: payment.status,
        transitioned: previousStatus !== payment.status,
      };
    }

    payment.status = 'succeeded';
    payment.txHash = verifiedTxHash || entityId('tx');
    payment.updatedAt = now;
    if (verifiedPayer) {
      payment.metadata = {
        ...(payment.metadata ?? {}),
        payer: verifiedPayer,
      };
    }
    if (dashboardPayment) {
      markDashboardPaymentSucceeded(dashboardPayment, now, payment.txHash);
      markPaymentLinkCompletion(store, dashboardPayment);
    }
    const successUrl = successUrlForCheckoutPayment(store, paymentId);

    return {
      status: 200 as const,
      payload: {
        ...serializePayment(payment),
        successUrl,
      },
      payment,
      merchantId: payment.merchantId,
      finalStatus: payment.status,
      transitioned: previousStatus !== payment.status,
    };
  });

  if (
    'merchantId' in outcome &&
    'payment' in outcome &&
    outcome.merchantId &&
    outcome.payment &&
    'finalStatus' in outcome
  ) {
    const store = await readStore();
    const merchant = store.merchants.find(
      (entry) => entry.merchantId === outcome.merchantId,
    );

    if (merchant && outcome.transitioned) {
      const status = outcome.finalStatus as 'succeeded' | 'failed' | 'expired';
      const eventType =
        status === 'succeeded'
          ? 'payment.succeeded'
          : status === 'failed'
            ? 'payment.failed'
            : 'payment.expired';

      await queueEventForMerchant(eventType, outcome.payment, merchant);
    }

    if (
      merchant &&
      outcome.transitioned &&
      outcome.finalStatus === 'succeeded' &&
      merchant.notifyPaymentSucceeded
    ) {
      void sendMerchantPaymentSucceededEmail({
        to: merchant.email,
        merchantName: merchant.name,
        amount: outcome.payment.amount,
        currency: outcome.payment.currency,
        orderId: outcome.payment.merchantOrderId,
        paymentId: outcome.payment.paymentId,
        customerEmail: outcome.payment.customerEmail,
        txHash: outcome.payment.txHash,
        dashboardUrl: `${config.webOrigin.replace(/\/$/, '')}/payments/detail?id=${outcome.payment.paymentId}`,
      });
    }

    // Best-effort: send a receipt email for terminal statuses.
    if (merchant && outcome.transitioned) {
      const to = asString(outcome.payment.customerEmail).trim();
      if (
        to &&
        z.string().email().safeParse(to).success &&
        !to.toLowerCase().endsWith('@checkout.local')
      ) {
        const status = outcome.finalStatus as
          | 'succeeded'
          | 'failed'
          | 'expired';
        void sendCustomerPaymentReceiptEmail({
          to,
          merchantName: merchant.name,
          status,
          amount: outcome.payment.amount,
          currency: outcome.payment.currency,
          orderId: outcome.payment.merchantOrderId,
          paymentId: outcome.payment.paymentId,
          txHash: outcome.payment.txHash,
        });
      }
    }
  }

  res.status(outcome.status).json(outcome.payload);
});

app.use('/dashboard', requireSession);

app.get('/dashboard/webhook-secret', async (_req, res) => {
  const authedReq = _req as unknown as AuthedRequest;
  res.json({
    secret: authedReq.merchant.webhookSecret,
    webhookUrl: authedReq.merchant.webhookUrl,
  });
});

app.get('/dashboard/workspace', async (_req, res) => {
  const authedReq = _req as unknown as AuthedRequest;
  const merchant = authedReq.merchant;

  res.json({
    id: 1,
    name: merchant.brandName || merchant.name,
    slug: merchant.merchantId,
    status: 'Live',
    siteUrl: config.checkoutBaseUrl,
    supportEmail: merchant.email,
    brandAccent: merchant.brandAccent,
  });
});

app.get('/dashboard/current-user', async (_req, res) => {
  const authedReq = _req as unknown as AuthedRequest;
  const merchant = authedReq.merchant;

  res.json({
    id: 1,
    name: merchant.name,
    initials: initialsForName(merchant.name),
    role: 'Owner',
    team: 'Business',
    email: merchant.email,
  });
});

app.get('/dashboard/notifications', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const store = await readStore();
  const notifications = asMerchantScopedRows(
    store.dashboard.notifications,
    merchantId,
  ).map(stripMerchantScope);

  res.json(sortRows(notifications, req.query as Record<string, unknown>));
});

app.get('/dashboard/metrics', async (_req, res) => {
  const authedReq = _req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const store = await readStore();
  const payments = asMerchantScopedRows(store.dashboard.payments, merchantId);
  const links = asMerchantScopedRows(store.dashboard.paymentLinks, merchantId);
  const endpoints = asMerchantScopedRows(
    store.dashboard.webhookEndpoints,
    merchantId,
  );
  res.json(buildDashboardMetrics(payments, links, endpoints));
});

app.get('/dashboard/payments', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const store = await readStore();
  const scoped = asMerchantScopedRows(store.dashboard.payments, merchantId).map(
    (entry) => stripMerchantScope(withLifecycleTimelineBackfill(entry)),
  );
  res.json(sortRows(scoped, req.query as Record<string, unknown>));
});

app.get('/dashboard/payments/:id', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const store = await readStore();
  const item = store.dashboard.payments.find(
    (entry) => entry.id === req.params.id && entry.merchantId === merchantId,
  );
  if (!item) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }
  res.json(stripMerchantScope(withLifecycleTimelineBackfill(item)));
});

app.post('/dashboard/payments', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  if (!isConfiguredWalletAddress(authedReq.merchant.walletAddress)) {
    res
      .status(409)
      .json({
        error:
          'Add a payout wallet address in Settings before creating payments.',
      });
    return;
  }
  const body = req.body as DashboardPayment;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid payment payload' });
    return;
  }
  const customerEmail = asString(body.customerEmail).trim();
  if (!z.string().email().safeParse(customerEmail).success) {
    res
      .status(400)
      .json({ error: 'Customer email is required and must be valid' });
    return;
  }

  const nowIso = new Date().toISOString();
  const paymentId =
    typeof body.id === 'string' && body.id ? body.id : entityId('pay');
  const checkoutUrl = checkoutUrlFor(paymentId);
  const createdAt = asString(body.createdAt, nowIso);
  const updatedAt = asString(body.updatedAt, createdAt);
  const amountNumber = asNumber(body.amount, 0);
  const expiresMinutes = Math.max(
    1,
    Math.round(asNumber(body.expiresInMinutes, 30)),
  );
  const expiresAt = new Date(
    Date.now() + expiresMinutes * 60 * 1000,
  ).toISOString();
  const merchantOrderId = asString(body.orderId).trim() || null;
  const checkoutStatus = normalizeCheckoutStatus(body.status);

  const next = withMerchantScope(
    {
      ...body,
      customerEmail,
      id: paymentId,
      checkoutUrl,
      createdAt,
      updatedAt,
    },
    merchantId,
  );

  await mutateStore((store) => {
    store.dashboard.payments.unshift(next);

    const existingCheckoutPayment = store.payments.find(
      (entry) =>
        entry.paymentId === paymentId && entry.merchantId === merchantId,
    );

    if (!existingCheckoutPayment) {
      store.payments.push({
        paymentId,
        merchantId,
        amount: amountNumber.toFixed(2),
        currency: 'USDT0',
        merchantOrderId,
        customerEmail,
        successUrl:
          asString((body as Record<string, unknown>).successUrl).trim() || null,
        expiresAt,
        status: checkoutStatus,
        metadata: null,
        checkoutUrl,
        txHash: checkoutStatus === 'succeeded' ? entityId('tx') : null,
        createdAt,
        updatedAt,
      });
    }
  });

  // Create the initial webhook event/job for the newly created payment.
  const storeAfter = await readStore();
  const merchant = storeAfter.merchants.find(
    (entry) => entry.merchantId === merchantId,
  );
  const createdPayment = storeAfter.payments.find(
    (entry) => entry.paymentId === paymentId && entry.merchantId === merchantId,
  );
  if (merchant && createdPayment) {
    await queueEventForMerchant('payment.pending', createdPayment, merchant);
  }

  // Best-effort: email the hosted checkout link to the customer.
  void sendCustomerPaymentCreatedEmail({
    to: customerEmail,
    merchantName: authedReq.merchant.name,
    amount: amountNumber.toFixed(2),
    currency: 'USDT0',
    orderId: merchantOrderId,
    paymentId,
    checkoutUrl,
  });

  res.status(201).json(stripMerchantScope(next));
});

app.patch('/dashboard/payments/:id', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const id = req.params.id;

  const updated = await mutateStore((store) => {
    const current = store.dashboard.payments.find(
      (entry) => entry.id === id && entry.merchantId === merchantId,
    );
    if (!current) return null;
    Object.assign(current, req.body);
    current.checkoutUrl = checkoutUrlFor(id);
    current.updatedAt = asString(current.updatedAt, new Date().toISOString());

    const checkoutPayment = store.payments.find(
      (entry) => entry.paymentId === id && entry.merchantId === merchantId,
    );

    if (checkoutPayment) {
      checkoutPayment.amount = asNumber(current.amount, 0).toFixed(2);
      checkoutPayment.merchantOrderId =
        asString(current.orderId).trim() || null;
      checkoutPayment.status = normalizeCheckoutStatus(current.status);
      checkoutPayment.checkoutUrl = checkoutUrlFor(id);
      checkoutPayment.updatedAt = asString(
        current.updatedAt,
        new Date().toISOString(),
      );
    }

    return current;
  });

  if (!updated) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }

  res.json(stripMerchantScope(updated));
});

app.get('/dashboard/payment-links', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const store = await readStore();
  const scoped = asMerchantScopedRows(
    store.dashboard.paymentLinks,
    merchantId,
  ).map((entry) => {
    const copy = { ...entry };
    recomputePaymentLinkMetrics(store, copy);
    return stripMerchantScope(copy);
  });
  res.json(sortRows(scoped, req.query as Record<string, unknown>));
});

app.get('/dashboard/payment-links/:id', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const store = await readStore();
  const item = store.dashboard.paymentLinks.find(
    (entry) => entry.id === req.params.id && entry.merchantId === merchantId,
  );
  if (!item) {
    res.status(404).json({ error: 'Payment link not found' });
    return;
  }
  const copy = { ...item };
  recomputePaymentLinkMetrics(store, copy);
  res.json(stripMerchantScope(copy));
});

app.post('/dashboard/payment-links', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const body = req.body as DashboardPaymentLink;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid payment link payload' });
    return;
  }
  if (
    asString((body as Record<string, unknown>).status).toLowerCase() ===
    'active'
  ) {
    if (!isConfiguredWalletAddress(authedReq.merchant.walletAddress)) {
      res
        .status(409)
        .json({
          error:
            'Add a payout wallet address in Settings before activating payment links.',
        });
      return;
    }
  }

  const next = withMerchantScope(
    {
      ...body,
      id: typeof body.id === 'string' && body.id ? body.id : entityId('link'),
    },
    merchantId,
  );

  await mutateStore((store) => {
    store.dashboard.paymentLinks.unshift(next);
  });

  res.status(201).json(stripMerchantScope(next));
});

app.patch('/dashboard/payment-links/:id', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const id = req.params.id;
  if (typeof req.body === 'object' && req.body) {
    const patch = req.body as Record<string, unknown>;
    const nextStatus = asString(patch.status).toLowerCase();
    if (
      nextStatus === 'active' &&
      !isConfiguredWalletAddress(authedReq.merchant.walletAddress)
    ) {
      res
        .status(409)
        .json({
          error:
            'Add a payout wallet address in Settings before activating payment links.',
        });
      return;
    }
  }

  const updated = await mutateStore((store) => {
    const current = store.dashboard.paymentLinks.find(
      (entry) => entry.id === id && entry.merchantId === merchantId,
    );
    if (!current) return null;
    Object.assign(current, req.body);
    return current;
  });

  if (!updated) {
    res.status(404).json({ error: 'Payment link not found' });
    return;
  }

  res.json(stripMerchantScope(updated));
});

app.get('/dashboard/api-keys', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const store = await readStore();
  const scoped = asMerchantScopedRows(store.dashboard.apiKeys, merchantId).map(
    (row) => {
      const stripped = stripMerchantScope(row) as Record<string, unknown>;
      delete stripped.secretHash;
      return stripped;
    },
  );
  res.json(sortRows(scoped, req.query as Record<string, unknown>));
});

app.post('/dashboard/api-keys', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const body = req.body as DashboardApiKey;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid API key payload' });
    return;
  }

  const label = asString((body as Record<string, unknown>).label).trim();
  const environment = asString(
    (body as Record<string, unknown>).environment,
    'Live',
  ).trim();
  const scopes = Array.isArray((body as Record<string, unknown>).scopes)
    ? ((body as Record<string, unknown>).scopes as unknown[])
        .map((value) => asString(value).trim())
        .filter(Boolean)
    : [];

  if (label.length < 2 || !scopes.length) {
    res.status(400).json({ error: 'API key label and scopes are required.' });
    return;
  }

  const envSlug = environment.toLowerCase();
  const prefix =
    asString((body as Record<string, unknown>).prefix).trim() ||
    `${envSlug}_pk_${Math.random().toString(36).slice(2, 5)}`;

  // Always mint server-side. If the client sent a secret, ignore it.
  const secret = randomToken(
    prefix.startsWith('sk_') ? prefix : `sk_${prefix}`,
  );
  const secretHash = sha256Hex(secret);
  const now = new Date().toISOString();

  const next = withMerchantScope(
    {
      id: typeof body.id === 'string' && body.id ? body.id : entityId('key'),
      label,
      environment,
      createdAt: asString((body as Record<string, unknown>).createdAt, now),
      owner: asString(
        (body as Record<string, unknown>).owner,
        authedReq.merchant.name,
      ),
      status: asString((body as Record<string, unknown>).status, 'active'),
      lastRotatedAt: asString(
        (body as Record<string, unknown>).lastRotatedAt,
        now,
      ),
      scopes,
      prefix,
      // Persist only the hash; secret is revealed once in the response.
      secretHash,
      // NOTE: For this hackathon build we persist the secret so it can be copied anytime.
      // In production you would store this encrypted, or only store a hash and require rotation on loss.
      revealedSecret: secret,
      sunsetAt:
        asString((body as Record<string, unknown>).sunsetAt) || undefined,
    },
    merchantId,
  );

  await mutateStore((store) => {
    store.dashboard.apiKeys.unshift(next);
  });

  const stripped = stripMerchantScope(next) as Record<string, unknown>;
  delete stripped.secretHash;
  res.status(201).json(stripped);
});

app.patch('/dashboard/api-keys/:id', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const id = req.params.id;

  const updated = await mutateStore((store) => {
    const current = store.dashboard.apiKeys.find(
      (entry) => entry.id === id && entry.merchantId === merchantId,
    );
    if (!current) return null;
    const patch = { ...(req.body as Record<string, unknown>) };
    delete (patch as Record<string, unknown>).revealedSecret;
    delete (patch as Record<string, unknown>).secretHash;
    Object.assign(current, patch);
    return current;
  });

  if (!updated) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }

  const stripped = stripMerchantScope(updated) as Record<string, unknown>;
  delete stripped.secretHash;
  res.json(stripped);
});

app.get('/dashboard/webhook-endpoints', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const store = await readStore();
  const scoped = asMerchantScopedRows(
    store.dashboard.webhookEndpoints,
    merchantId,
  ).map((row) => ({
    ...stripMerchantScope(row),
    // Merchant-level signing secret (shared across endpoints in this MVP).
    secret: authedReq.merchant.webhookSecret,
  }));
  res.json(sortRows(scoped, req.query as Record<string, unknown>));
});

app.post('/dashboard/webhook-endpoints', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const body = req.body as DashboardWebhookEndpoint;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid endpoint payload' });
    return;
  }

  const next = withMerchantScope(
    {
      ...body,
      id:
        typeof body.id === 'string' && body.id ? body.id : entityId('endpoint'),
    },
    merchantId,
  );

  await mutateStore((store) => {
    store.dashboard.webhookEndpoints.unshift(next);

    // Keep the core webhook configuration aligned to the most recently created endpoint.
    const merchant = store.merchants.find(
      (entry) => entry.merchantId === merchantId,
    );
    if (merchant) {
      merchant.webhookUrl =
        asString((next as Record<string, unknown>).url).trim() || null;
    }
  });

  res.status(201).json({
    ...stripMerchantScope(next),
    revealedSecret: authedReq.merchant.webhookSecret,
    secret: authedReq.merchant.webhookSecret,
  });
});

app.patch('/dashboard/webhook-endpoints/:id', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const id = req.params.id;

  const updated = await mutateStore((store) => {
    const current = store.dashboard.webhookEndpoints.find(
      (entry) => entry.id === id && entry.merchantId === merchantId,
    );
    if (!current) return null;
    Object.assign(current, req.body);
    return current;
  });

  if (!updated) {
    res.status(404).json({ error: 'Endpoint not found' });
    return;
  }

  res.json(stripMerchantScope(updated));
});

app.post('/dashboard/webhook-secret/rotate', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const now = new Date().toISOString();
  const nextSecret = randomToken('whsec');

  await mutateStore((store) => {
    const merchant = store.merchants.find(
      (entry) => entry.merchantId === merchantId,
    );
    if (merchant) {
      merchant.webhookSecret = nextSecret;
    }

    for (const endpoint of store.dashboard.webhookEndpoints) {
      if (asString(endpoint.merchantId) !== merchantId) continue;
      (endpoint as Record<string, unknown>).secretLastRotatedAt = now;
    }
  });

  res.json({ revealedSecret: nextSecret, rotatedAt: now });
});

app.get('/dashboard/webhook-events', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const store = await readStore();
  const scopedDashboard = asMerchantScopedRows(
    store.dashboard.webhookEvents,
    merchantId,
  );

  const defaultEndpointId = activeDashboardWebhookEndpointId(store, merchantId);

  const mergedById = new Map<string, DashboardWebhookEvent>();

  for (const item of scopedDashboard) {
    mergedById.set(item.id, item);
  }

  for (const coreEvent of store.webhookEvents) {
    if (coreEvent.merchantId !== merchantId) continue;
    if (mergedById.has(coreEvent.id)) continue;
    mergedById.set(
      coreEvent.id,
      buildDashboardWebhookEventFromCore(coreEvent, defaultEndpointId),
    );
  }

  const merged = [...mergedById.values()].map(stripMerchantScope);
  res.json(sortRows(merged, req.query as Record<string, unknown>));
});

app.post('/dashboard/webhook-events', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const body = req.body as DashboardWebhookEvent;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid webhook event payload' });
    return;
  }

  const next = withMerchantScope(
    {
      ...body,
      id: typeof body.id === 'string' && body.id ? body.id : entityId('evt'),
    },
    merchantId,
  );

  await mutateStore((store) => {
    store.dashboard.webhookEvents.unshift(next);
  });

  res.status(201).json(stripMerchantScope(next));
});

app.patch('/dashboard/webhook-events/:id', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const id = req.params.id;

  const updated = await mutateStore((store) => {
    const current = store.dashboard.webhookEvents.find(
      (entry) => entry.id === id && entry.merchantId === merchantId,
    );
    if (current) {
      Object.assign(current, req.body);
      return current;
    }

    const coreEvent = store.webhookEvents.find(
      (entry) => entry.id === id && entry.merchantId === merchantId,
    );
    if (!coreEvent) return null;

    const defaultEndpointId = activeDashboardWebhookEndpointId(
      store,
      merchantId,
    );
    const seeded = buildDashboardWebhookEventFromCore(
      coreEvent,
      defaultEndpointId,
    );
    Object.assign(seeded, req.body);
    store.dashboard.webhookEvents.unshift(seeded);
    return seeded;
  });

  if (!updated) {
    res.status(404).json({ error: 'Webhook event not found' });
    return;
  }

  res.json(stripMerchantScope(updated));
});

app.post('/dashboard/webhook-events/:id/resend', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const id = req.params.id;

  const store = await readStore();
  const merchant = store.merchants.find(
    (entry) => entry.merchantId === merchantId,
  );
  if (!merchant) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!merchant.webhookUrl) {
    res.status(409).json({ error: 'No webhook endpoint configured.' });
    return;
  }

  const coreEvent = store.webhookEvents.find(
    (entry) => entry.id === id && entry.merchantId === merchantId,
  );
  if (!coreEvent) {
    res.status(404).json({ error: 'Webhook event not found' });
    return;
  }

  const now = new Date().toISOString();
  const job = buildWebhookJob({
    eventId: coreEvent.id,
    merchantId,
    url: merchant.webhookUrl as string,
    secret: merchant.webhookSecret,
    maxAttempts: config.webhookRetryMaxAttempts,
  });

  await mutateStore((innerStore) => {
    innerStore.webhookJobs.push(job);

    const dashboardEvent = innerStore.dashboard.webhookEvents.find(
      (entry) =>
        asString(entry.id) === id && asString(entry.merchantId) === merchantId,
    );
    if (dashboardEvent) {
      (dashboardEvent as Record<string, unknown>).status = 'queued';
      (dashboardEvent as Record<string, unknown>).deliveredAt = null;
      (dashboardEvent as Record<string, unknown>).responseBody = '';
      (dashboardEvent as Record<string, unknown>).updatedAt = now;
    }
  });

  res.json({ ok: true, queued: true, jobId: job.id });
});

app.get('/dashboard/refunds', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const store = await readStore();
  const scoped = asMerchantScopedRows(store.dashboard.refunds, merchantId).map(
    stripMerchantScope,
  );
  res.json(sortRows(scoped, req.query as Record<string, unknown>));
});

app.post('/dashboard/refunds', async (req, res) => {
  const authedReq = req as unknown as AuthedRequest;
  const merchantId = authedReq.merchant.merchantId;
  const body = req.body as DashboardRefund;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid refund payload' });
    return;
  }

  const next = withMerchantScope(
    {
      ...body,
      id: typeof body.id === 'string' && body.id ? body.id : entityId('refund'),
    },
    merchantId,
  );

  await mutateStore((store) => {
    store.dashboard.refunds.unshift(next);
  });

  res.status(201).json(stripMerchantScope(next));
});

app.get('/dashboard/docs', async (_req, res) => {
  const docs = await readDocsCatalog();
  res.json(docs);
});

app.get('/dashboard/docs/:slug', async (req, res) => {
  const slug = req.params.slug;
  const docs = await readDocsCatalog();
  const doc = docs.find((entry) => entry.slug === slug);

  if (!doc) {
    res.status(404).json({ error: 'Doc not found' });
    return;
  }

  const docsRoot = path.isAbsolute(config.docsPath)
    ? config.docsPath
    : path.resolve(process.cwd(), config.docsPath);

  try {
    const markdown = await fs.readFile(path.join(docsRoot, doc.file), 'utf8');
    res.json({ ...doc, markdown });
  } catch {
    res.status(500).json({ error: 'Unable to load documentation file.' });
  }
});

async function bootstrap() {
  setInterval(() => {
    void processWebhookJobs();
  }, 3000);

  app.listen(config.port, () => {
    console.log(`Fluxpay Checkout backend running on ${config.apiBaseUrl}`);
  });
}

void bootstrap();
