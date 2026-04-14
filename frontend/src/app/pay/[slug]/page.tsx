"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Brand from "@/components/Brand";
import { API_BASE } from "@/lib/api";

type PublicPaymentLink = {
  id: string;
  slug: string;
  title: string;
  status: string;
  type: "fixed" | "open";
  currency: string;
  amount: number | null;
  successUrl: string | null;
  merchantName: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
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

export default function PayByLinkPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const [link, setLink] = useState<PublicPaymentLink | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creatingRef = useRef(false);
  const viewPingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!slug) {
        setLoading(false);
        setError("Payment link is missing.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await request<PublicPaymentLink>(
          `/public/payment-links/${encodeURIComponent(slug)}`,
        );
        if (cancelled) return;
        setLink(data);
        if (data.type === "fixed" && typeof data.amount === "number") {
          setAmount(data.amount.toFixed(2));
        }

        // Record a page view. Next dev mode can double-invoke effects, so
        // use a short session dedupe window to avoid inflated counts.
        if (!viewPingRef.current && typeof window !== "undefined") {
          viewPingRef.current = true;
          try {
            const key = `fluxpay_view_ping_${slug}`;
            const last = Number(window.sessionStorage.getItem(key) ?? "0");
            const now = Date.now();
            if (!Number.isFinite(last) || now - last > 2000) {
              window.sessionStorage.setItem(key, String(now));
              void request<{ ok: boolean }>(
                `/public/payment-links/${encodeURIComponent(slug)}/view`,
                { method: "POST" },
              ).catch(() => null);
            }
          } catch {
            // Best-effort only.
          }
        }
      } catch (requestError) {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load payment link.",
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
  }, [slug]);

  const amountNumber = useMemo(() => Number(amount || 0), [amount]);
  const canStartCheckout =
    !!link &&
    link.status === "active" &&
    (link.type === "fixed" || amountNumber > 0) &&
    !creating;

  async function startCheckout() {
    if (!link || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setError(null);

    try {
      const payload =
        link.type === "open" ? { amount: amountNumber.toFixed(2) } : {};
      const created = await request<{ checkoutUrl: string }>(
        `/public/payment-links/${encodeURIComponent(link.slug)}/checkout`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      if (typeof window !== "undefined") {
        window.location.assign(created.checkoutUrl);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create checkout session.",
      );
      setCreating(false);
      creatingRef.current = false;
    }
  }

  if (loading) {
    return (
      <main className="checkout-wrap">
        <section className="state-card">
          <div className="state-body">
            <h1>Loading payment link...</h1>
          </div>
        </section>
      </main>
    );
  }

  if (!link || error) {
    return (
      <main className="checkout-wrap">
        <section className="state-card">
          <div className="state-top">
            <Brand />
            <span className="status warn">Unavailable</span>
          </div>
          <div className="state-body">
            <h1>Payment link unavailable.</h1>
            <p className="cell-muted">{error ?? "Link not found."}</p>
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
          <span className={`status ${link.status === "active" ? "ok" : "warn"}`}>
            {link.status}
          </span>
        </div>
        <div className="state-body">
          <h1>{link.title}</h1>
          <p className="cell-muted">
            {link.merchantName} hosted checkout link.
          </p>

          <div className="meta-row">
            <div className="meta-box">
              <small>Merchant</small>
              <strong>{link.merchantName}</strong>
            </div>
            <div className="meta-box">
              <small>Type</small>
              <strong>{link.type === "open" ? "Open amount" : "Fixed amount"}</strong>
            </div>
          </div>

          {link.type === "open" ? (
            <div className="field" style={{ maxWidth: 280 }}>
              <label htmlFor="open-amount">Amount ({link.currency})</label>
              <input
                id="open-amount"
                className="input"
                inputMode="decimal"
                type="text"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Enter amount"
              />
            </div>
          ) : (
            <div className="amount-box">
              <small>Amount</small>
              <strong>{Number(link.amount ?? 0).toFixed(2)} {link.currency}</strong>
            </div>
          )}

          {error ? <div className="form-error">{error}</div> : null}

          <div className="state-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void startCheckout()}
              disabled={!canStartCheckout}
            >
              {creating ? "Preparing checkout..." : "Continue to checkout"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
