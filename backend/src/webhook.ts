import crypto from "crypto";
import { entityId } from "./utils.js";
import type { Payment, WebhookAttempt, WebhookEvent, WebhookJob } from "./types.js";

export function buildEvent(type: WebhookEvent["type"], payment: Payment): WebhookEvent {
  return {
    id: entityId("evt"),
    merchantId: payment.merchantId,
    type,
    createdAt: new Date().toISOString(),
    data: {
      paymentId: payment.paymentId,
      amount: payment.amount,
      currency: payment.currency,
      txHash: payment.txHash,
    },
    attempts: [],
  };
}

export function signWebhook(rawBody: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function signWebhookWithTimestamp(params: {
  rawBody: string;
  secret: string;
  timestamp: string;
}) {
  const payload = `${params.timestamp}.${params.rawBody}`;
  return crypto.createHmac("sha256", params.secret).update(payload).digest("hex");
}

export function buildWebhookJob(params: {
  eventId: string;
  merchantId: string;
  url: string;
  secret: string;
  maxAttempts: number;
  nextAttemptAt?: string;
}): WebhookJob {
  return {
    id: entityId("job"),
    eventId: params.eventId,
    merchantId: params.merchantId,
    url: params.url,
    secret: params.secret,
    attempts: 0,
    maxAttempts: params.maxAttempts,
    nextAttemptAt: params.nextAttemptAt ?? new Date().toISOString(),
    status: "queued",
    lastError: null,
  };
}

export async function deliverWebhook(params: {
  url: string;
  event: WebhookEvent;
  secret: string;
  timeoutMs: number;
}): Promise<WebhookAttempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  const rawBody = JSON.stringify(params.event);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signWebhookWithTimestamp({
    rawBody,
    secret: params.secret,
    timestamp,
  });

  try {
    const response = await fetch(params.url, {
      method: "POST",
      body: rawBody,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-signature": signature,
        "x-signature-timestamp": timestamp,
      },
    });

    const responseBody = await response.text();

    return {
      attemptId: entityId("attempt"),
      at: new Date().toISOString(),
      delivered: response.ok,
      statusCode: response.status,
      responseBody: responseBody || null,
      error: null,
    };
  } catch (error) {
    return {
      attemptId: entityId("attempt"),
      at: new Date().toISOString(),
      delivered: false,
      statusCode: null,
      responseBody: null,
      error: error instanceof Error ? error.message : "Unknown webhook dispatch error",
    };
  } finally {
    clearTimeout(timer);
  }
}
