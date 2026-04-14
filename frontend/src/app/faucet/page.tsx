"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Brand from "@/components/Brand";
import { useToast } from "@/components/ToastProvider";
import { API_BASE } from "@/lib/api";

type FaucetStatus = {
  enabled: boolean;
  chainId: number;
  tokenAddress: string | null;
  amount: number;
  decimals: number;
  cooldownSeconds: number;
  explorerBaseUrl: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await response.text();
  const json = (() => {
    try {
      return JSON.parse(text) as any;
    } catch {
      return null;
    }
  })();

  if (!response.ok) {
    const message = typeof json?.error === "string" ? json.error : `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return (json ?? ({} as any)) as T;
}

export default function FaucetPage() {
  const toast = useToast();
  const [status, setStatus] = useState<FaucetStatus | null>(null);
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ txHash: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await request<FaucetStatus>("/public/faucet");
        if (!cancelled) setStatus(data);
      } catch (error) {
        if (!cancelled) setStatus(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isValidAddress = useMemo(
    () => /^0x[a-fA-F0-9]{40}$/.test(address.trim()),
    [address],
  );

  const explorerTxUrl = useMemo(() => {
    if (!status || !result) return null;
    return `${status.explorerBaseUrl.replace(/\/$/, "")}/tx/${result.txHash}`;
  }, [result, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    if (!status?.enabled) {
      toast.error("Faucet is not enabled.");
      return;
    }

    if (!isValidAddress) {
      toast.error("Enter a valid 0x address.");
      return;
    }

    setSubmitting(true);
    try {
      const minted = await request<{ ok: boolean; txHash: string }>(
        "/public/faucet",
        {
          method: "POST",
          body: JSON.stringify({ address: address.trim() }),
        },
      );
      setResult({ txHash: minted.txHash });
      toast.success("USDT0 sent. Check your wallet in a moment.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to request faucet.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="checkout-wrap">
      <section className="state-card">
        <div className="state-top">
          <Brand />
          <span className={`status ${status?.enabled ? "ok" : "warn"}`}>
            {status?.enabled ? "Testnet faucet" : "Unavailable"}
          </span>
        </div>
        <div className="state-body">
          <h1>USDT0 testnet faucet</h1>
          <p className="cell-muted">
            Paste a Conflux eSpace testnet wallet address and request test USDT0.
            You still need test CFX for transaction fees when you pay in checkout.
          </p>

          <div className="meta-row" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
            <div className="meta-box">
              <small>Chain</small>
              <strong>{status ? `eSpace (${status.chainId})` : "--"}</strong>
            </div>
            <div className="meta-box">
              <small>Amount</small>
              <strong>{status ? `${status.amount} USDT0` : "--"}</strong>
            </div>
            <div className="meta-box">
              <small>Token</small>
              <strong title={status?.tokenAddress ?? ""}>
                {status?.tokenAddress ? `${status.tokenAddress.slice(0, 6)}…${status.tokenAddress.slice(-4)}` : "--"}
              </strong>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
            <div className="field">
              <label htmlFor="address">Wallet address</label>
              <input
                id="address"
                className="input"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>

            <div className="state-actions" style={{ marginTop: 14 }}>
              <button className="btn btn-primary" type="submit" disabled={!status?.enabled || !isValidAddress || submitting}>
                {submitting ? "Requesting..." : "Request USDT0"}
              </button>
              <Link className="btn btn-secondary" href="/checkout">
                Go to checkout
              </Link>
            </div>
          </form>

          {explorerTxUrl ? (
            <div className="note-row" style={{ marginTop: 16 }}>
              <div className="row-copy">
                <strong>Mint transaction</strong>
                <span title={result?.txHash ?? ""}>{result?.txHash}</span>
              </div>
              <a className="btn btn-ghost" href={explorerTxUrl} target="_blank" rel="noreferrer">
                View on explorer
              </a>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

