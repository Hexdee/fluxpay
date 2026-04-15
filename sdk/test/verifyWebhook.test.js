const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { verifyWebhook } = require("../dist/index.js");

function signWithTimestamp({ rawBody, secret, timestamp }) {
  const payload = `${timestamp}.${rawBody}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

test("verifyWebhook accepts valid signature", () => {
  const secret = "whsec_test_secret_123";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify({
    id: "evt_123",
    type: "payment.succeeded",
    createdAt: new Date().toISOString(),
    data: {
      paymentId: "pay_123",
      amount: "25.00",
      currency: "USDT0",
      txHash: "0xabc",
    },
  });

  const signature = signWithTimestamp({ rawBody, secret, timestamp });
  const event = verifyWebhook({
    rawBody,
    signature,
    timestamp,
    secret,
    toleranceSeconds: 300,
  });

  assert.equal(event.type, "payment.succeeded");
  assert.equal(event.data.paymentId, "pay_123");
});

test("verifyWebhook rejects stale timestamps", () => {
  const secret = "whsec_test_secret_123";
  const now = Date.now();
  const timestamp = String(Math.floor((now - 10 * 60 * 1000) / 1000));
  const rawBody = JSON.stringify({
    id: "evt_124",
    type: "payment.pending",
    createdAt: new Date().toISOString(),
    data: {
      paymentId: "pay_124",
      amount: "25.00",
      currency: "USDT0",
      txHash: null,
    },
  });

  const signature = signWithTimestamp({ rawBody, secret, timestamp });

  assert.throws(() => {
    verifyWebhook({
      rawBody,
      signature,
      timestamp,
      secret,
      toleranceSeconds: 300,
      now,
    });
  }, /replay window/i);
});

