# FluxPay Checkout SDK

TypeScript SDK for the FluxPay Checkout API.

Package: `fluxpay-checkout-sdk`

## Build

```bash
npm install
npm run build
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
    plan: 'pro',
  },
});

console.log(payment.checkoutUrl);
```

Errors throw `CheckoutApiError` with `status` and raw `body` when available.

## Auth helpers (optional)

If you want to create an account programmatically, you can call auth endpoints
without an API key:

```ts
const publicClient = new CheckoutClient();

const signup = await publicClient.auth.signup({
  name: 'Acme Store',
  email: 'owner@acme.com',
  password: 'strong-password',
});

// Save these securely.
console.log(signup.apiKey, signup.webhookSecret);
```

## Webhook verification

FluxPay webhooks include:

- `x-signature`: HMAC-SHA256 hex digest of `<timestamp>.<raw_body>`
- `x-signature-timestamp`: unix seconds

Verify them using:

```ts
import { verifyWebhook } from 'fluxpay-checkout-sdk';

const event = verifyWebhook({
  rawBody,
  signature: req.headers['x-signature'],
  timestamp: req.headers['x-signature-timestamp'],
  secret: process.env.FLUXPAY_WEBHOOK_SECRET!,
  toleranceSeconds: 300,
});
```
