import type {
  ApiKey,
  CurrentUser,
  DashboardMetrics,
  DocRecord,
  Notification,
  Payment,
  PaymentLink,
  Refund,
  WebhookEndpoint,
  WebhookEvent,
  Workspace,
  MerchantProfile,
} from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

function getSessionToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('fluxpay_session_token');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionToken = getSessionToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
    ...init,
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.localStorage.removeItem('fluxpay_session_token');
    }
    throw new Error(`Request failed for ${path}: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getResource<T>(path: string) {
  return request<T>(path);
}

export function createResource<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateResource<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function replaceResource<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deleteResource(path: string) {
  return request<void>(path, {
    method: 'DELETE',
  });
}

export const api = {
  me: () => getResource<MerchantProfile>('/auth/me'),
  updateMe: (body: Omit<Partial<MerchantProfile>, 'walletAddress'> & { walletAddress?: string | null }) =>
    updateResource<MerchantProfile>('/auth/me', body),
  workspace: () => getResource<Workspace>('/dashboard/workspace'),
  currentUser: () => getResource<CurrentUser>('/dashboard/current-user'),
  notifications: () => getResource<Notification[]>('/dashboard/notifications?_sort=createdAt&_order=desc'),
  dashboardMetrics: () => getResource<DashboardMetrics>('/dashboard/metrics'),
  payments: () => getResource<Payment[]>('/dashboard/payments?_sort=updatedAt&_order=desc'),
  payment: (id: string) => getResource<Payment>(`/dashboard/payments/${id}`),
  createPayment: (body: Payment) => createResource<Payment>('/dashboard/payments', body),
  updatePayment: (id: string, body: Partial<Payment>) => updateResource<Payment>(`/dashboard/payments/${id}`, body),
  paymentLinks: () => getResource<PaymentLink[]>('/dashboard/payment-links?_sort=updatedAt&_order=desc'),
  paymentLink: (id: string) => getResource<PaymentLink>(`/dashboard/payment-links/${id}`),
  createPaymentLink: (body: PaymentLink) => createResource<PaymentLink>('/dashboard/payment-links', body),
  updatePaymentLink: (id: string, body: Partial<PaymentLink>) => updateResource<PaymentLink>(`/dashboard/payment-links/${id}`, body),
  apiKeys: () => getResource<ApiKey[]>('/dashboard/api-keys?_sort=createdAt&_order=desc'),
  createApiKey: (body: ApiKey) => createResource<ApiKey>('/dashboard/api-keys', body),
  updateApiKey: (id: string, body: Partial<ApiKey>) => updateResource<ApiKey>(`/dashboard/api-keys/${id}`, body),
  webhookEndpoints: () => getResource<WebhookEndpoint[]>('/dashboard/webhook-endpoints?_sort=lastEventAt&_order=desc'),
  createWebhookEndpoint: (body: WebhookEndpoint) => createResource<WebhookEndpoint>('/dashboard/webhook-endpoints', body),
  updateWebhookEndpoint: (id: string, body: Partial<WebhookEndpoint>) => updateResource<WebhookEndpoint>(`/dashboard/webhook-endpoints/${id}`, body),
  rotateWebhookSecret: () =>
    createResource<{ revealedSecret: string; rotatedAt: string }>('/dashboard/webhook-secret/rotate', {}),
  webhookSecret: () =>
    getResource<{ secret: string; webhookUrl: string | null }>('/dashboard/webhook-secret'),
  webhookEvents: () => getResource<WebhookEvent[]>('/dashboard/webhook-events?_sort=createdAt&_order=desc'),
  createWebhookEvent: (body: WebhookEvent) => createResource<WebhookEvent>('/dashboard/webhook-events', body),
  updateWebhookEvent: (id: string, body: Partial<WebhookEvent>) => updateResource<WebhookEvent>(`/dashboard/webhook-events/${id}`, body),
  resendWebhookEvent: (id: string) =>
    createResource<{ ok: boolean; queued: boolean; jobId: string }>(`/dashboard/webhook-events/${id}/resend`, {}),
  refunds: () => getResource<Refund[]>('/dashboard/refunds?_sort=createdAt&_order=desc'),
  createRefund: (body: Refund) => createResource<Refund>('/dashboard/refunds', body),
  docs: () => getResource<DocRecord[]>('/dashboard/docs'),
  docBySlug: (slug: string) =>
    getResource<DocRecord & { markdown: string }>(`/dashboard/docs/${encodeURIComponent(slug)}`),
};

export { API_BASE };
