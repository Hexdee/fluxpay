import { API_BASE } from '@/lib/api';

export type CheckoutPayment = {
  paymentId: string;
  amount: string;
  currency: string;
  merchantOrderId: string | null;
  status: 'pending' | 'succeeded' | 'expired' | 'failed';
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  txHash: string | null;
  merchantName: string;
  successUrl?: string | null;
  chain?: { chainId: number; usdt0Address: string; paymentProcessorAddress: string } | null;
  paymentIntent?: {
    paymentId: string;
    merchant: string;
    amount: string;
    expiresAt: number;
    metadataHash: string;
  } | null;
  paymentSignature?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getCheckoutPayment(paymentId: string) {
  return request<CheckoutPayment>(`/checkout/payments/${encodeURIComponent(paymentId)}`);
}

export function confirmCheckoutPayment(paymentId: string) {
  return request<CheckoutPayment>('/checkout/payments/' + encodeURIComponent(paymentId) + '/confirm', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function confirmCheckoutPaymentWithTx(paymentId: string, payload: { txHash: string; walletAddress?: string }) {
  return request<CheckoutPayment>('/checkout/payments/' + encodeURIComponent(paymentId) + '/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
