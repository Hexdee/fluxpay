# API Spec (MVP)

Base URL: `http://localhost:4000` (local dev)

## Authentication

- `Authorization: Bearer <api_key>`

## Create payment

`POST /payments`

Request:

```json
{
  "amount": "25.00",
  "currency": "USDT0",
  "customerEmail": "billing@customer.com",
  "merchantOrderId": "order_123",
  "successUrl": "https://merchant.example.com/success",
  "expiresInMinutes": 30,
  "metadata": {
    "customerId": "cust_45",
    "product": "Pro Plan"
  }
}
```

Response:

```json
{
  "paymentId": "pay_123",
  "status": "pending",
  "checkoutUrl": "http://localhost:3000/checkout?paymentId=pay_123",
  "onchain": {
    "token": "USDT0",
    "amount": "25.00"
  }
}
```

## Get payment

`GET /payments/:id`

Response:

```json
{
  "paymentId": "pay_123",
  "status": "succeeded",
  "amount": "25.00",
  "currency": "USDT0",
  "merchantOrderId": "order_123",
  "successUrl": "https://merchant.example.com/success",
  "txHash": "0x...",
  "createdAt": "2026-04-12T12:00:00Z",
  "updatedAt": "2026-04-12T12:01:10Z",
  "checkoutUrl": "http://localhost:3000/checkout?paymentId=pay_123",
  "expiresAt": "2026-04-12T12:30:00Z",
  "onchain": { "token": "USDT0", "amount": "25.00" }
}
```

## List payments

`GET /merchants/:id/payments`

Response:

```json
{
  "items": [
    {
      "paymentId": "pay_123",
      "status": "succeeded",
      "amount": "25.00",
      "currency": "USDT0",
      "createdAt": "2026-04-12T12:00:00Z",
      "updatedAt": "2026-04-12T12:01:10Z",
      "checkoutUrl": "http://localhost:3000/checkout?paymentId=pay_123",
      "expiresAt": "2026-04-12T12:30:00Z"
    }
  ]
}
```

## Test webhook

`POST /webhooks/test`

Response:

```json
{ "ok": true }
```

## Webhook events

Event types:

- `payment.pending`
- `payment.succeeded`
- `payment.failed`
- `payment.expired`

Payload:

```json
{
  "id": "evt_123",
  "type": "payment.succeeded",
  "createdAt": "2026-04-12T12:01:10Z",
  "data": {
    "paymentId": "pay_123",
    "amount": "25.00",
    "currency": "USDT0",
    "txHash": "0x..."
  }
}
```

Delivery headers:

- `x-signature`: HMAC-SHA256 signature of `<timestamp>.<raw_body>`
- `x-signature-timestamp`: Unix timestamp in seconds used for replay-window checks
