import { ethers } from "ethers";
import { config } from "./config.js";

export const paymentProcessorAbi = [
  "function pay((bytes32 paymentId,address merchant,uint256 amount,uint256 expiresAt,bytes32 metadataHash) p, bytes sig) external",
  "event PaymentCompleted(bytes32 indexed paymentId,address indexed merchant,address indexed payer,address token,uint256 amount)",
];

export const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

export const paymentProcessorInterface = new ethers.Interface(paymentProcessorAbi);

export const provider =
  config.chainEnabled && config.rpcUrl
    ? new ethers.JsonRpcProvider(config.rpcUrl)
    : null;

