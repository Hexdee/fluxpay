import { defineChain } from "viem";

const defaultRpcs = [
  "https://evmtestnet.confluxrpc.com",
  "https://evmtest.confluxrpc.com",
  "https://evmtestnet.confluxrpc.org",
];
const rpcEnv =
  process.env.NEXT_PUBLIC_CONFLUX_TESTNET_RPC_URLS ??
  process.env.NEXT_PUBLIC_CONFLUX_TESTNET_RPC_URL ??
  defaultRpcs.join(",");

const rpcUrls = rpcEnv
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const confluxESpaceTestnet = defineChain({
  id: 71,
  name: "Conflux eSpace Testnet",
  network: "cfx-espace-testnet",
  nativeCurrency: {
    name: "CFX",
    symbol: "CFX",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: rpcUrls.length ? rpcUrls : defaultRpcs,
    },
    public: {
      http: rpcUrls.length ? rpcUrls : defaultRpcs,
    },
  },
  blockExplorers: {
    default: {
      name: "ConfluxScan",
      url: "https://evmtestnet.confluxscan.org",
    },
  },
});

export const confluxTestnetAddChainParams = {
  chainId: "0x47", // 71
  chainName: "Conflux eSpace Testnet",
  nativeCurrency: {
    name: "CFX",
    symbol: "CFX",
    decimals: 18,
  },
  rpcUrls: rpcUrls.length ? rpcUrls : defaultRpcs,
  blockExplorerUrls: ["https://evmtestnet.confluxscan.org"],
} as const;
