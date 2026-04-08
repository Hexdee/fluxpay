import { ethers } from "ethers";
import { config } from "./config.js";
import { provider, erc20Abi } from "./chain.js";

export type PaymentIntent = {
  paymentId: string; // bytes32
  merchant: string; // address
  amount: string; // uint256
  expiresAt: number; // uint256 (seconds)
  metadataHash: string; // bytes32
};

const domain = config.chainEnabled
  ? {
      name: "ConfluxCheckout",
      version: "1",
      chainId: config.chainId,
      verifyingContract: config.paymentProcessorAddress,
    }
  : null;

const types = {
  PaymentIntent: [
    { name: "paymentId", type: "bytes32" },
    { name: "merchant", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
    { name: "metadataHash", type: "bytes32" },
  ],
};

const signer =
  config.chainEnabled && config.signerPrivateKey
    ? new ethers.Wallet(config.signerPrivateKey)
    : null;

let cachedDecimals: number | null = null;

export async function getTokenDecimals(): Promise<number> {
  if (cachedDecimals !== null) return cachedDecimals;
  if (!provider) throw new Error("Chain provider not configured");
  const token = new ethers.Contract(config.usdt0Address, erc20Abi, provider);
  const decimals = await token.decimals();
  cachedDecimals = Number(decimals);
  return cachedDecimals;
}

export function hashPaymentId(paymentId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(paymentId));
}

export function hashMetadata(metadata: unknown): string {
  if (!metadata) return ethers.ZeroHash;
  const json = JSON.stringify(metadata);
  return ethers.keccak256(ethers.toUtf8Bytes(json));
}

export async function toBaseUnits(amount: string): Promise<string> {
  const decimals = await getTokenDecimals();
  return ethers.parseUnits(amount, decimals).toString();
}

export async function signIntent(intent: PaymentIntent): Promise<string> {
  if (!signer || !domain) {
    throw new Error("Signer not configured");
  }
  return signer.signTypedData(domain, types as any, intent as any);
}

