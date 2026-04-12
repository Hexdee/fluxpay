# JS SDK

## Install

```bash
npm install fluxpay-checkout-sdk
```

## Usage

```ts
import { CheckoutClient } from 'fluxpay-checkout-sdk';

const client = new CheckoutClient({
  apiKey: process.env.FLUXPAY_API_KEY!,
});

const payment = await client.payments.create({
  amount: '25.00',
  currency: 'USDT0',
  customerEmail: 'billing@customer.com',
  merchantOrderId: 'order_123',
  // Optional: redirect customers back to your app after successful checkout.
  successUrl: 'https://merchant.example.com/success',
  // Optional (defaults to 30 minutes).
  expiresInMinutes: 30,
  metadata: {
    customerId: 'cust_45',
    product: 'Pro Plan',
  },
});

console.log(payment.checkoutUrl);
```

## Auth (optional)

Auth endpoints do not require an API key:

```ts
const publicClient = new CheckoutClient();

const signup = await publicClient.auth.signup({
  name: 'Acme Store',
  email: 'owner@acme.com',
  password: 'strong-password',
});

console.log(signup.apiKey, signup.webhookSecret);
```

## Webhook verification

```ts
import { verifyWebhook } from 'fluxpay-checkout-sdk';

const event = verifyWebhook({
  rawBody,
  signature: req.headers['x-signature'],
  timestamp: req.headers['x-signature-timestamp'],
  secret: process.env.FLUXPAY_WEBHOOK_SECRET!,
  toleranceSeconds: 300,
});

if (event.type === 'payment.succeeded') {
  // fulfill order
}
```

## Client surface

```ts
class CheckoutClient {
  payments: {
    create(input: CreatePaymentInput): Promise<CreatePaymentResponse>;
    get(id: string): Promise<Payment>;
    listByMerchant(merchantId: string): Promise<{ items: Payment[] }>;
  };
  webhooks: {
    test(): Promise<{ ok: boolean }>;
  };
  auth: {
    signup(
      input: SignupInput,
    ): Promise<{ apiKey: string; webhookSecret: string }>;
    login(input: LoginInput): Promise<{ sessionToken: string }>;
  };
}
```
