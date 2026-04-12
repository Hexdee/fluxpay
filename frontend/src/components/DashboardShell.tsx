"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { MerchantProvider, MerchantSetupBanner } from "./MerchantProvider";

type DashboardShellProps = {
  active?: string;
  children: React.ReactNode;
};

export default function DashboardShell({ active, children }: DashboardShellProps) {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const token = typeof window !== "undefined"
      ? window.localStorage.getItem("fluxpay_session_token")
      : null;
    const expiresAt = typeof window !== "undefined"
      ? window.localStorage.getItem("fluxpay_session_expires_at")
      : null;

    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem("fluxpay_session_token");
      window.localStorage.removeItem("fluxpay_session_expires_at");
      router.replace("/auth");
      return;
    }

    if (!token) {
      router.replace("/auth");
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return null;
  }

  return (
    <MerchantProvider>
      <div className="app-shell">
        <Sidebar active={active} />
        <main className="content">
          <MerchantSetupBanner />
          {children}
        </main>
      </div>
    </MerchantProvider>
  );
}
