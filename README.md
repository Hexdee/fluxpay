# FluxPay

**Stablecoin checkout infrastructure for Conflux.**

FluxPay makes it easier for merchants and developers to accept **USDT0 on Conflux eSpace** with a clean hosted checkout, reusable payment links, developer SDKs, and webhook-driven order automation.

## What FluxPay does

FluxPay is built to give teams both sides of the payment stack:

- a **merchant-friendly checkout experience**
- a **developer-friendly API + SDK integration path**
- **payment status tracking** from creation to confirmation
- **webhook automation** for fulfillment, subscriptions, invoices, and internal workflows

## Core features

### Merchant-facing

- Hosted checkout
- Payment links
- Checkout expiry handling
- Success / cancel redirects
- Merchant dashboard for payment operations

### Developer-facing

- JavaScript / TypeScript SDK
- Checkout creation via API
- Webhook delivery and event logging
- Payment lifecycle handling
- Integration-friendly architecture for apps, bots, invoices, and digital products

## Merchant story

A merchant can:

1. Create a payment from the dashboard or API
2. Share a checkout link or embed the flow inside an app
3. Let the customer complete payment on Conflux eSpace
4. Receive a verified payment update
5. Automatically fulfill an order, unlock a product, or mark an invoice as paid

## Developer story

A developer can:

1. Create an API key
2. Install the SDK
3. Create a payment request
4. Redirect the customer to the returned checkout URL
5. Listen for webhook events to update application state

## Monorepo structure

```text
fluxpay/
├── backend/      # API, payment lifecycle logic, webhook handling
├── contracts/    # smart contracts / onchain layer
├── docs/         # project and integration docs
├── frontend/     # merchant-facing product and demo UI
├── sdk/          # fluxpay-checkout-sdk package
└── package.json  # root scripts for dev/build/start
```

## Getting started

### 1) Clone the repository

```bash
git clone https://github.com/hexdee/fluxpay.git
cd fluxpay
```

### 2) Install dependencies

```bash
npm install
```

### 3) Start development

```bash
npm run dev
```

### 4) Build everything

```bash
npm run build
```

### 5) Start production mode

```bash
npm run start
```

> Recommended runtime: **Node 20** for the full stack project.

## SDK

Install the SDK:

```bash
npm install fluxpay-checkout-sdk
```

Example:

```ts
import { CheckoutClient } from 'fluxpay-checkout-sdk';

const client = new CheckoutClient({
  apiKey: process.env.FLUXPAY_API_KEY!,
});

const payment = await client.payments.create({
  amount: '25.00',
  currency: 'USDT0',
  customerEmail: 'billing@customer.com',
  merchantOrderId: 'order_2048',
  expiresInMinutes: 30,
});

console.log(payment.checkoutUrl);
```

## Live links

- Demo site: https://fluxpay-demo.vercel.app
- Repository: https://github.com/hexdee/fluxpay
- SDK package: https://www.npmjs.com/package/fluxpay-checkout-sdk
- Backend deployment: https://fluxpay-7f5a.onrender.com

## Why FluxPay

Most payment projects stop at “send funds to an address.”

FluxPay is designed as a real **checkout layer**:

- better UX for merchants and customers
- faster integration for builders
- webhook-based automation for real business workflows
- a clearer bridge between onchain settlement and offchain product logic

## Ideal use cases

- SaaS billing
- subscription payments
- invoice collection
- digital product checkout
- bots and automated payment flows
- merchant tools on Conflux

## Current product direction

FluxPay is being built as:

- a hosted checkout product
- a merchant operations layer
- a reusable payments SDK
- an automation layer for Conflux-native commerce

## License

MIT
