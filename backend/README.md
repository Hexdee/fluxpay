# Backend (MVP)

Express backend for the FluxPay API.

## Run

```bash
npm install
npm run dev
```

Default base URL: `http://localhost:4000`

## Deploy (Docker)

This backend is ready to deploy as a Docker container (builds `dist/` and runs `node dist/index.js`).

### 1) Create a Postgres database

You can use a managed Postgres (recommended) or run Postgres yourself.

The backend expects:
- `DATABASE_URL` (example: `postgres://USER:PASSWORD@HOST:5432/fluxpay`)

On first start, it creates the minimal tables it needs automatically.

### 2) Configure environment variables

Copy `.env.example` and set values in your platform's secret manager:

- `PORT`
- `WEB_ORIGIN` (your frontend URL, for CORS)
- `API_BASE_URL` (public URL for this backend)
- `CHECKOUT_BASE_URL` (public URL for the hosted checkout frontend)
- `DATABASE_URL`
- `DOCS_PATH` (optional; defaults to `../docs`)
- `EXPOSE_DEV_AUTH_CODES` (should be `false` in production)

Optional (onchain checkout):
- `RPC_URL`
- `CHAIN_ID`
- `USDT0_ADDRESS`
- `PAYMENT_PROCESSOR_ADDRESS`
- `SIGNER_PRIVATE_KEY`

Optional (emails):
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### 3) Build and run

From repo root:

```bash
docker build -t fluxpay-backend ./backend
docker run --rm -p 4000:4000 --env-file ./backend/.env fluxpay-backend
```

### 4) Health check

`GET /health` should return `{ ok: true, service: "fluxpay-checkout-backend" }`.

## Deploy (Docker Compose)

For local/staging (backend + postgres):

```bash
docker compose -f docker-compose.backend.yml up --build
```

## Key endpoints

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/verify-email`
- `GET /auth/me` (Bearer session token)
- `POST /payments` (Bearer API key)
- `GET /payments/:id` (Bearer API key)
- `GET /merchants/:id/payments` (Bearer API key)
- `POST /payments/:id/simulate-succeeded` (Bearer API key)
- `POST /webhooks/test` (Bearer API key)
- `GET /webhooks/events` (Bearer API key)
- `GET /checkout/payments/:id`
- `POST /checkout/payments/:id/confirm`
- `GET /dashboard/*` (Bearer session token)

## Config

See `.env.example`.

Email delivery for signup verification and password reset uses SMTP (`SMTP_*` vars).
When SMTP is not configured, the API returns dev codes in auth responses for local testing.

Optional onchain checkout (Conflux eSpace) requires:

- `RPC_URL`
- `CHAIN_ID`
- `USDT0_ADDRESS`
- `PAYMENT_PROCESSOR_ADDRESS`
- `SIGNER_PRIVATE_KEY`

When configured, `GET /checkout/payments/:id` returns a signed EIP-712 payment intent and the hosted checkout will attempt an onchain `PaymentProcessor.pay(...)` call via the user's wallet.
