# Architecture

## Overview
The MVP is a simple payment stack that accepts USDT0 on Conflux eSpace and provides a hosted checkout experience plus a merchant dashboard.

Components:
- **PaymentProcessor** smart contract (eSpace)
- **API service** (creates payments, serves status)
- **Indexer** (listens to onchain events)
- **Webhook dispatcher** (notifies merchants)
- **Checkout app** (hosted page)
- **Dashboard app** (merchant UI)
- **JS SDK** (developer integration)

## Data flow
1. Merchant creates a payment via API or SDK
2. API returns `paymentId` and `checkoutUrl`
3. Customer opens checkout and pays onchain
4. Indexer detects `PaymentCompleted`
5. API updates DB status and triggers webhook
6. Dashboard shows paid state

## Payment flow (MVP)
- Customer approves USDT0 to `PaymentProcessor` (standard ERC20)
- Customer calls `pay()` with signed payment intent (server-signed)
- Contract transfers USDT0 into escrow (or directly to merchant)
- Event emitted

## Onchain/offchain separation
- Payment intent is created **offchain** and signed by the server to prevent tampering
- Contract verifies the signature to enforce exact token, amount, and expiry

## Deployment
- Conflux eSpace RPC
- USDT0 token address configured in backend and frontend
- Contract address stored in env
