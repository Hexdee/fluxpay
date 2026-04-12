"use client";

import "@rainbow-me/rainbowkit/styles.css";
import React, { useMemo } from "react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { confluxESpaceTestnet } from "@/lib/chains";
import { fallback } from "viem";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

const chains = [confluxESpaceTestnet] as const;
const transport = (() => {
  const urls = confluxESpaceTestnet.rpcUrls.default.http;
  const transports = urls.map((url) =>
    http(url, {
      // Fail fast rather than hanging for 30s+ when the public RPC is rate-limiting.
      retryCount: 2,
      retryDelay: 200,
      timeout: 10_000,
    }),
  );
  return transports.length > 1 ? fallback(transports) : transports[0]!;
})();

const wagmiConfig = createConfig({
  chains,
  ssr: true,
  connectors: [
    injected({ shimDisconnect: true }),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            showQrModal: false,
          }),
        ]
      : []),
  ],
  transports: {
    [confluxESpaceTestnet.id]: transport,
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={confluxESpaceTestnet}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
