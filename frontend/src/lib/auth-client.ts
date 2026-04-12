import { API_BASE } from '@/lib/api';

type RequestOptions = {
  method?: 'POST' | 'GET';
  body?: unknown;
};

async function authRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export type AuthSignupResponse = {
  merchantId: string;
  apiKey: string;
  webhookSecret: string;
  sessionToken: string;
  sessionExpiresAt: string;
  verificationEmailSent: boolean;
  devVerificationCode?: string;
};

export type AuthLoginResponse = {
  merchantId: string;
  email: string;
  name: string;
  apiKeyHint: string;
  sessionToken: string;
  sessionExpiresAt: string;
};

export function signup(input: {
  name: string;
  email: string;
  password: string;
}) {
  return authRequest<AuthSignupResponse>('/auth/signup', { body: input });
}

export function login(input: { email: string; password: string }) {
  return authRequest<AuthLoginResponse>('/auth/login', { body: input });
}

export function forgotPassword(input: { email: string }) {
  return authRequest<{ ok: boolean; message: string; devCode?: string }>(
    '/auth/forgot-password',
    { body: input },
  );
}

export function resetPassword(input: {
  email: string;
  code: string;
  password: string;
}) {
  return authRequest<{ ok: boolean }>('/auth/reset-password', { body: input });
}

export function verifyEmail(input: { email: string; code: string }) {
  return authRequest<{
    ok: boolean;
    merchantId: string;
    sessionToken: string;
    sessionExpiresAt: string;
  }>('/auth/verify-email', { body: input });
}
