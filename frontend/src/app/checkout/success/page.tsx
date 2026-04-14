"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Brand from "@/components/Brand";
import TruncateCopy from "@/components/TruncateCopy";
import { downloadJson } from "@/lib/export";
import { getCheckoutPayment } from "@/lib/checkout";

function buildReturnUrl(successUrl: string, paymentId: string) {
  try {
    const target = new URL(successUrl, typeof window !== "undefined" ? window.location.origin : undefined);
    target.searchParams.set("paymentId", paymentId);
    return target.toString();
  } catch {
    return successUrl;
  }
}

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("Merchant");
  const [amount, setAmount] = useState("--");
  const [currency, setCurrency] = useState("USDT0");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      setError("Missing payment reference.");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const checkoutPayment = await getCheckoutPayment(paymentId);

        if (cancelled) return;

        if (checkoutPayment.status !== "succeeded") {
          router.replace(`/checkout?paymentId=${encodeURIComponent(paymentId)}`);
          return;
        }

        setMerchantName(checkoutPayment.merchantName);
        setAmount(checkoutPayment.amount);
        setCurrency(checkoutPayment.currency);
        setOrderId(checkoutPayment.merchantOrderId);
        setTxHash(checkoutPayment.txHash);
        setSuccessUrl(checkoutPayment.successUrl ?? null);
      } catch (requestError) {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load payment summary.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [paymentId, router]);

  if (loading) {
    return (
      <main className="checkout-wrap">
        <section className="state-card">
          <div className="state-body">
            <h1>Loading payment summary...</h1>
          </div>
        </section>
      </main>
    );
  }

  if (error || !paymentId) {
    return (
      <main className="checkout-wrap">
        <section className="state-card">
          <div className="state-top">
            <Brand />
            <span className="status warn">Unavailable</span>
          </div>
          <div className="state-body">
            <h1>Unable to load payment details.</h1>
            <p className="cell-muted">{error ?? "Payment not found."}</p>
            <div className="state-actions">
              <Link className="btn btn-primary" href="/">
                Return home
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-wrap">
      <section className="state-card">
        <div className="state-top">
          <Brand />
          <span className="status ok">Payment successful</span>
        </div>
        <div className="state-body">
          <h1>Thank you for your payment.</h1>
          <p className="cell-muted">
            Your payment has been confirmed on Conflux eSpace and the merchant has been notified.
          </p>
          <div className="amount-box">
            <small>Amount paid</small>
            <strong>{amount} {currency}</strong>
          </div>
          <div className="meta-row">
            <div className="meta-box">
              <small>Order</small>
              {orderId ? (
                <TruncateCopy value={orderId} label="Copy order reference" />
              ) : (
                <TruncateCopy value={paymentId} label="Copy payment ID" />
              )}
            </div>
            <div className="meta-box">
              <small>Payment ID</small>
              <TruncateCopy value={paymentId} label="Copy payment ID" />
            </div>
            <div className="meta-box">
              <small>Network</small>
              <strong>Conflux eSpace</strong>
            </div>
          </div>
          <div className="state-rows">
            <div className="state-row">
              <span>Transaction hash</span>
              {txHash ? (
                <TruncateCopy value={txHash} label="Copy transaction hash" head={10} tail={10} />
              ) : (
                <strong>Pending</strong>
              )}
            </div>
            <div className="state-row">
              <span>Merchant</span>
              <strong>{merchantName}</strong>
            </div>
          </div>
          <div className="state-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() =>
                downloadJson(
                  {
                    paymentId,
                    amount,
                    currency,
                    orderId,
                    txHash,
                    merchantName,
                  },
                  `${paymentId}-receipt.json`,
                )
              }
            >
              View receipt
            </button>
            {successUrl ? (
              <Link
                className="btn btn-secondary"
                href={buildReturnUrl(successUrl, paymentId)}
              >
                Return to merchant
              </Link>
            ) : null}
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() =>
                downloadJson(
                  { paymentId, orderId, amount, currency, merchantName },
                  `${paymentId}-invoice.json`,
                )
              }
            >
              Download invoice
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="checkout-wrap">
          <section className="state-card">
            <div className="state-body">
              <h1>Loading payment summary...</h1>
            </div>
          </section>
        </main>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
