"use client";

import { useEffect } from "react";
import { API_BASE } from "@/lib/api";

/**
 * Best-effort warmup ping for sleeping backends (e.g. free-tier Render).
 * This should never block UI rendering or throw.
 */
export default function BackendWarmup() {
  useEffect(() => {
    let cancelled = false;

    function ping() {
      if (cancelled) return;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      fetch(`${API_BASE}/health`, {
        method: "GET",
        signal: controller.signal,
        headers: { "x-fluxpay-warmup": "1" },
      })
        .catch(() => null)
        .finally(() => clearTimeout(timeout));
    }

    // Don't compete with initial render / hydration.
    if ("requestIdleCallback" in globalThis) {
      (globalThis as any).requestIdleCallback(ping, { timeout: 2000 });
    } else {
      setTimeout(ping, 250);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
