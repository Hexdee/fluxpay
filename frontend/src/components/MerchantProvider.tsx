"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/lib/api";
import type { MerchantProfile } from "@/lib/types";

type MerchantContextValue = {
  profile: MerchantProfile | null;
  loading: boolean;
  walletConfigured: boolean;
  refresh: () => void;
};

const MerchantContext = createContext<MerchantContextValue | null>(null);

function isConfiguredWalletAddress(value: string | null | undefined) {
  const address = String(value ?? "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) return false;
  return address !== "0x0000000000000000000000000000000000000000";
}

export function MerchantProvider({ children }: { children: React.ReactNode }) {
  const me = useApiResource(api.me);

  const value = useMemo<MerchantContextValue>(() => {
    const profile = me.data ?? null;
    return {
      profile,
      loading: me.loading,
      walletConfigured: profile ? isConfiguredWalletAddress(profile.walletAddress) : false,
      refresh: () => void me.refresh(),
    };
  }, [me.data, me.loading, me.refresh]);

  return <MerchantContext.Provider value={value}>{children}</MerchantContext.Provider>;
}

export function useMerchant() {
  const ctx = useContext(MerchantContext);
  if (!ctx) throw new Error("useMerchant must be used inside MerchantProvider.");
  return ctx;
}

export function MerchantSetupBanner() {
  const { profile, loading, walletConfigured } = useMerchant();
  if (loading) return null;
  if (!profile) return null;
  if (walletConfigured) return null;

  return (
    <section className="setup-banner" role="status">
      <div>
        <strong>Action required:</strong>{" "}
        Add a payout wallet address to start creating payments and activating payment links.
      </div>
      <a className="btn btn-secondary" href="/settings?tab=profile">
        Open settings
      </a>
    </section>
  );
}

